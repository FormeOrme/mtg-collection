import { read, loadFile, writeToData } from "../lib/io.js";
import { oracleDataMap, OMENPATH_MAP } from "../lib/loaders.js";
import { strip } from "../lib/utils.js";
import { formatYYYYMMDD, writeCsvFiles } from "../lib/csvUtils.js";
import {
    readCardDb,
    validateCards,
    enrichCardsWithDbData,
    processCardData,
} from "../lib/dbUtils.js";
import axios from "axios";

async function loadCollectionData() {
    const url = "http://localhost:6842/cards";
    try {
        const { data: collection } = await axios.get(url);
        console.log(`[${url}] online`);
        writeToData(JSON.stringify(collection), `collection-${formatYYYYMMDD(new Date())}.json`);
        return collection;
    } catch {
        // offline fallback
        console.warn(`[${url}] offline, loading local collection`);
        return JSON.parse(read(loadFile("collection", "json")));
    }
}

const BASIC = "Plains,Island,Swamp,Mountain,Forest,Wastes"
    .split(",")
    .flatMap((type) => [type, `Snow-Covered ${type}`]);

// --- top-level await (ESM) ---

const cardDb = await readCardDb();
console.log(`Loaded [${Object.keys(cardDb).length}] cards from card database`);

const allGroupIds = Object.keys(cardDb).map(Number);
console.log("LOADING COLLECTION");
const collectionData = await loadCollectionData();

// Validate cards against database
validateCards(collectionData.cards, allGroupIds);

// Enrich cards with database data and process them
collectionData.cards = enrichCardsWithDbData(collectionData.cards, cardDb);
collectionData.cards = processCardData(collectionData.cards, BASIC);

const arenaCollection = [
    ...collectionData.cards,
    ...BASIC.map((name) => ({ name, owned: 4 })),
].reduce((map, { name, owned }) => {
    const key = strip(name);
    const currentOwned = map.get(key) ?? 0;
    map.set(key, Math.min(currentOwned + owned, 4));
    return map;
}, new Map());

const mappedCards = new Map(
    [...arenaCollection].flatMap(([name, owned]) => {
        const mapped = OMENPATH_MAP.get(name)?.mtgName;
        return mapped ? [[mapped, owned]] : [];
    }),
);

console.log(`Added [${mappedCards.size}] omenpath cards to arena collection`);

writeToData(
    `[\n${[...new Map([...arenaCollection, ...mappedCards])]
        .toSorted(([a], [b]) => a.localeCompare(b))
        .map(([n, o]) => `["${n}", ${o}]`)
        .join(",\n")}\n]`,
    "arena_collection.json",
);
