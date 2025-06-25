import path from "path";
import { getDataFilePath, readDataFile, defaultData, oracleData, legalCards, strip, onArena, modernLegal, colorIdentity, sets } from "./common.js";
import axios from "axios";
import sqlite3 from "sqlite3";

const dataDir = path.join(path.dirname(new URL(import.meta.url).pathname), '../data');

const formatYYYYMMDD = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}${month}${day}`;
};

const getCsvLine = (c) => `"${c.name}",${c.set},${c.owned}`;
const csvRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
const csvMap = (arr) =>
    arr
        .split(/\n/g)
        .map((r) => r.split(csvRegex))
        .reduce((a, [name, edition, count]) => {
            a[`${name},${edition}`] = count;
            return a;
        }, {});

function getDiff(lastCsv, newCsv) {
    const lastArr = csvMap(lastCsv);
    const newArr = csvMap(newCsv);
    const diff = [];
    Object.entries(newArr).map(([k, v]) => {
        const lastValue = lastArr[k];
        if (!!lastValue) {
            if (lastValue != v) {
                diff.push(`${k},${v - lastValue}`);
            }
        } else {
            diff.push(`${k},${v}`);
        }
    });
    console.log(`[${diff.length}] rows diff`);
    return diff.join("\n");
}

/* New-Item -ItemType Junction -Name Raw -Value "C:\Program Files (x86)\Steam\steamapps\common\MTGA\MTGA_Data\Downloads\Raw" */

const readCardDB = new Promise((resolve) => {
    const dbName = common.loadFile("Raw_CardDatabase", "mtga", "Raw");
    console.log("Using db", dbName);
    const cardDB = new sqlite3.Database(dbName, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            console.error(err.message);
        }
        console.log(`Connected to [${dbName}]`);
    });
    const out = {};
    cardDB.each(
        common.read("cardDBQuery.sql"),
        (err, row) => {
            if (!(out[row.grpId] && row.enUS?.match(/<|>/))) {
                out[row.grpId] = row;
            }
        },
        () => {
            resolve(out);
        },
    );
});

const loadCollectionData = new Promise((resolve) => {
    const url = "http://localhost:6842/cards";
    new Promise((res) =>
        axios
            .get(url)
            .then((response) => {
                console.log(`[${url}] online`);
                return res(response?.data);
            })
            .catch((_) => res()),
    ).then((coll) => {
        if (coll) {
            common.write(JSON.stringify(coll), `collection-${formatYYYYMMDD(new Date())}.json`);
        }
        resolve(coll || JSON.parse(common.read(common.loadFile("collection", "json"))));
    });
});

const BASIC = "Plains,Island,Swamp,Mountain,Forest,Wastes"
    .split(",")
    .flatMap((c) => [c, `Snow-Covered ${c}`]);

const csvHeader = `"Name","Edition","Count"`;

readCardDB.then((cardDB) => {
    // console.log(cardDB);
    const allGroupIds = Object.keys(cardDB).map(Number);
    console.log("LOADING COLLECTION");
    loadCollectionData.then((collectionData) => {
        const invalidCards = collectionData.cards.filter((c) => !allGroupIds.includes(c.grpId));
        console.warn("INVALID CARDS COUNT:", invalidCards.length);
        // print the first 10 invalid cards
        invalidCards.slice(0, 10).forEach((c) => {
            console.warn(`Invalid card: ${c.name} (${c.grpId})`);
        });

        collectionData.cards = collectionData.cards
            .map((c) => ({
                ...c,
                ...cardDB[c.grpId],
            }))
            .filter((c) => !BASIC.includes(c.name))
            .map((c) => {
                c.name = c.name?.replace("///", "//");
                c.set = c.set?.replace("ANA", "ANB");
                /* TODO MANAGE SET LIKE AJMP */
                return c;
            });

        // console.log(collectionData.cards.filter((c, i) => i < 10));

        const arenaCollection = Object.values(
            [
                ...collectionData.cards,
                ...BASIC.map((c) => ({
                    name: c,
                    owned: 4,
                })),
            ].reduce((map, card) => {
                map[card.name] = map[card.name] ?? { n: common.strip(card.name), o: 0 };
                map[card.name].o += card.owned;
                map[card.name].o = Math.min(map[card.name].o, 4);
                return map;
            }, {}),
        ).sort((a, b) => a.n.localeCompare(b.n));

        common.write(JSON.stringify(arenaCollection), "arena_collection.json");

        console.time("creating csv");
        let newCsvContent = csvHeader;
        collectionData.cards.forEach((c) => {
            newCsvContent += "\n" + getCsvLine(c);
        });

        console.timeEnd("creating csv");

        const lastCsv = common.loadFile("csvToImport_", "csv");
        console.log(`Creating diff from [${lastCsv}]`);
        const lastCsvContent = common.read(lastCsv).toString();

        const diff = csvHeader + "\n" + getDiff(lastCsvContent, newCsvContent);
        console.time("writing diff");
        common.write(diff, `diff_${formatYYYYMMDD(new Date())}.csv`);
        console.timeEnd("writing diff");

        console.time("writing csv");
        common.write(newCsvContent, `csvToImport_${formatYYYYMMDD(new Date())}.csv`);
        console.timeEnd("writing csv");
    });
});
