import { read, loadFile, writeToData } from "../lib/io.js";
import { strip } from "../lib/utils.js";
import { formatYYYYMMDD, writeCsvFiles } from "../lib/csvUtils.js";
import { BASIC } from "../lib/domain.js";
import { oracleData } from "../lib/loaders.js";

const oracleMap = Object.fromEntries(oracleData().map((card) => [strip(card.name), card]));

function parseCollectionText(rawCollectionText) {
    return rawCollectionText
        .split(/\r?\n/)
        .map((rawLine) => {
            const line = rawLine.trim();
            if (!line) {
                return;
            }
            const match = line.match(/^(\d+)\s+(.+)$/);
            if (!match) {
                console.warn(`Skipping invalid line: ${line}`);
                return;
            }
            const parsedName = match[2].trim();
            const id = strip(parsedName);
            if (!id) {
                console.warn(`Skipping invalid card name: ${line}`);
                return;
            }

            if(BASIC.some((basic) => basic.name === parsedName)) {
                return;
            }

            return {
                owned: Math.min(Number.parseInt(match[1], 10), 4),
                name: parsedName,
                id,
                card: oracleMap[id],
            };
        })
        .filter(Boolean);
}

function loadCollectionData() {
    const collectionFilePath = loadFile("mtga_collection_", "txt", "sources");
    const rawCollectionText = read(collectionFilePath).toString();
    const cards = parseCollectionText(rawCollectionText);
    console.log(`Loaded [${cards.length}] collection lines from [${collectionFilePath}]`);
    return [
        ...cards,
        ...BASIC,
    ];
}

const WRITE_TIME = "WRITING COLLECTION";
const LOAD_TIME = "LOADING COLLECTION";
console.time(LOAD_TIME);
const collectionData = loadCollectionData();
console.timeEnd(LOAD_TIME);

console.time(WRITE_TIME);
writeToData(
    `[\n${collectionData
        .toSorted((a,b) => {
            const releaseCompare = (a.card?.released_at?.localeCompare(b.card?.released_at) || 0);
            if (releaseCompare !== 0) return releaseCompare;
            return a.id.localeCompare(b.id);
        })
        .map((card) => `["${card.id}", ${card.owned}]`)
        .join(",\n")}\n]`,
    "arena_collection.json",
);
console.timeEnd(WRITE_TIME);

