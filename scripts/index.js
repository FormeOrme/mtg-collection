import { strip } from "./common.js";
import * as common from "./common.js";
import axios from "axios";
import sqlite3 from "sqlite3";

const formatYYYYMMDD = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}${month}${day}`;
};

const getCsvLine = (card) => `"${card.name}",${card.set},${card.owned}`;
const csvRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
const csvMap = (arr) =>
    arr
        .split(/\n/g)
        .map((row) => row.split(csvRegex))
        .reduce((acc, [name, edition, count]) => {
            acc[`${name},${edition}`] = count;
            return acc;
        }, {});

function getDiff(lastCsv, newCsv) {
    const lastArr = csvMap(lastCsv);
    const newArr = csvMap(newCsv);
    const diff = [];
    Object.entries(newArr).forEach(([key, value]) => {
        const lastValue = lastArr[key];
        if (lastValue !== undefined) {
            if (lastValue != value) {
                diff.push(`${key},${value - lastValue}`);
            }
        } else {
            diff.push(`${key},${value}`);
        }
    });
    console.log(`[${diff.length}] rows diff`);
    return diff.join("\n");
}

async function readCardDb() {
    return new Promise((resolve) => {
        const dbName = common.loadFile("Raw_CardDatabase", "mtga", "Raw");
        console.log("Using db", dbName);
        const cardDb = new sqlite3.Database(dbName, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.error(err.message);
            }
            console.log(`Connected to [${dbName}]`);
        });
        const out = {};

        const queryPath = common.loadFile("cardDBQuery", "sql");
        const query = common.read(queryPath).toString();
        if (!query.trim()) {
            console.error("SQL query is empty! Path:", queryPath);
            resolve({});
            return;
        }
        cardDb.each(
            query,
            (err, row) => {
                if (err) {
                    console.error("SQL error:", err);
                }
                if (!(out[row.grpId] && row.enUS?.match(/<|>/))) {
                    out[row.grpId] = row;
                }
            },
            () => {
                resolve(out);
            },
        );
    });
}

async function loadCollectionData() {
    const url = "http://localhost:6842/cards";
    let collection;
    try {
        const response = await axios.get(url);
        console.log(`[${url}] online`);
        collection = response?.data;
    } catch (error) {
        // offline fallback
    }
    if (collection) {
        common.write(JSON.stringify(collection), `collection-${formatYYYYMMDD(new Date())}.json`);
        return collection;
    }
    return JSON.parse(common.read(common.loadFile("collection", "json")));
}

const BASIC = "Plains,Island,Swamp,Mountain,Forest,Wastes"
    .split(",")
    .flatMap((type) => [type, `Snow-Covered ${type}`]);

const CSV_HEADER = `"Name","Edition","Count"`;

(async function main() {
    const cardDb = await readCardDb();
    console.log(`Loaded [${Object.keys(cardDb).length}] cards from card database`);

    const allGroupIds = Object.keys(cardDb).map(Number);
    console.log("LOADING COLLECTION");
    const collectionData = await loadCollectionData();
    const invalidCards = collectionData.cards.filter((card) => !allGroupIds.includes(card.grpId));
    console.warn("INVALID CARDS COUNT:", invalidCards.length);
    invalidCards.slice(0, 10).forEach((card) => {
        console.warn(`Invalid card: ${card.name} (${card.grpId})`);
    });

    collectionData.cards = collectionData.cards
        .map((card) => ({
            ...card,
            ...cardDb[card.grpId],
        }))
        .filter((card) => !BASIC.includes(card.name))
        .map((card) => {
            card.name = card.name?.replace("///", "//");
            card.set = card.set?.replace("ANA", "ANB");
            return card;
        });

    const arenaCollection = Object.values(
        [
            ...collectionData.cards,
            ...BASIC.map((name) => ({
                name,
                owned: 4,
            })),
        ].reduce((map, card) => {
            map[card.name] = map[card.name] ?? { n: strip(card.name), o: 0 };
            map[card.name].o += card.owned;
            map[card.name].o = Math.min(map[card.name].o, 4);
            return map;
        }, {}),
    ).sort((a, b) => a.n.localeCompare(b.n));

    common.write(JSON.stringify(arenaCollection), "arena_collection.json");

    console.time("creating csv");
    let newCsvContent = CSV_HEADER;
    collectionData.cards.forEach((card) => {
        newCsvContent += "\n" + getCsvLine(card);
    });
    console.timeEnd("creating csv");

    const lastCsv = common.loadFile("csvToImport_", "csv");
    console.log(`Creating diff from [${lastCsv}]`);
    const lastCsvContent = common.read(lastCsv).toString();

    const diff = CSV_HEADER + "\n" + getDiff(lastCsvContent, newCsvContent);
    console.time("writing diff");
    common.write(diff, `diff_${formatYYYYMMDD(new Date())}.csv`);
    console.timeEnd("writing diff");

    console.time("writing csv");
    common.write(newCsvContent, `csvToImport_${formatYYYYMMDD(new Date())}.csv`);
    console.timeEnd("writing csv");
})();
