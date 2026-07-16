import { read, loadFile, writeToData } from "../lib/io.js";
import { strip } from "../lib/utils.js";
import { formatYYYYMMDD, writeCsvFiles } from "../lib/csvUtils.js";
import { processCardData } from "../lib/dbUtils.js";

function parseCollectionText(rawCollectionText) {
    return rawCollectionText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .flatMap((line) => {
            const match = line.match(/^(\d+)\s+(.+)$/);
            if (!match) {
                console.warn(`Skipping invalid line: ${line}`);
                return [];
            }

            const parsedName = match[2].trim();
            const normalizedName = strip(parsedName);
            if (!normalizedName) {
                console.warn(`Skipping invalid card name: ${line}`);
                return [];
            }

            return [
                {
                    owned: Number.parseInt(match[1], 10),
                    name: parsedName,
                    normalizedName,
                },
            ];
        });
}

function loadCollectionData() {
    const collectionFilePath = loadFile("mtga_collection_", "txt", "sources");
    const rawCollectionText = read(collectionFilePath).toString();
    const cards = parseCollectionText(rawCollectionText);
    console.log(`Loaded [${cards.length}] collection lines from [${collectionFilePath}]`);
    return { cards };
}

const BASIC = "Plains,Island,Swamp,Mountain,Forest,Wastes"
    .split(",")
    .flatMap((type) => [type, `Snow-Covered ${type}`]);

console.log("LOADING COLLECTION");
const collectionData = loadCollectionData();

collectionData.cards = processCardData(collectionData.cards, BASIC);

const arenaCollection = [
    ...collectionData.cards,
    ...BASIC.map((name) => ({ name, owned: 4 })),
].reduce((map, { name, normalizedName, owned }) => {
    const key = normalizedName ?? strip(name);
    const safeOwned = Number.isFinite(owned) ? Math.max(owned, 0) : 0;
    const currentOwned = map.get(key) ?? 0;
    map.set(key, Math.min(currentOwned + safeOwned, 4));
    return map;
}, new Map());

writeToData(
    `[\n${[...arenaCollection]
        .toSorted(([a], [b]) => a.localeCompare(b))
        .map(([n, o]) => `["${n}", ${o}]`)
        .join(",\n")}\n]`,
    "arena_collection.json",
);
