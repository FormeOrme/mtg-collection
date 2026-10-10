import { read, loadFile, writeToData } from "../lib/io.js";
import { strip } from "../lib/utils.js";
import { formatYYYYMMDD, writeCsvFiles } from "../lib/csvUtils.js";
import { BASIC } from "../lib/domain.js";

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
            const normalizedName = strip(parsedName);
            if (!normalizedName) {
                console.warn(`Skipping invalid card name: ${line}`);
                return;
            }

            if(BASIC.some((basic) => basic.name === parsedName)) {
                return;
            }

            return {
                owned: Math.min(Number.parseInt(match[1], 10), 4),
                name: parsedName,
                normalizedName,
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

console.log("LOADING COLLECTION");
const collectionData = loadCollectionData();

writeToData(
    `[\n${collectionData
        .toSorted((a, b) => a.normalizedName.localeCompare(b.normalizedName))
        .map((card) => `["${card.normalizedName}", ${card.owned}]`)
        .join(",\n")}\n]`,
    "arena_collection.json",
);
