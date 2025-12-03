import { read, loadFile, writeToData, oracleDataMap, strip, OMENPATH_MAP } from "./common.js";
import { formatYYYYMMDD, writeCsvFiles } from "./csvUtils.js";
import { readCardDb, validateCards, enrichCardsWithDbData, processCardData } from "./dbUtils.js";
import axios from "axios";

async function loadCollectionData() {
    const url = "http://localhost:6842/cards";
    let collection;
    try {
        const response = await axios.get(url);
        console.log(`[${url}] online`);
        collection = response?.data;
    } catch (error) {
        // offline fallback
        console.warn(`[${url}] offline, loading local collection`);
        return JSON.parse(read(loadFile("collection", "json")));
    }
    if (collection) {
        writeToData(JSON.stringify(collection), `collection-${formatYYYYMMDD(new Date())}.json`);
        return collection;
    }
}

const BASIC = "Plains,Island,Swamp,Mountain,Forest,Wastes"
    .split(",")
    .flatMap((type) => [type, `Snow-Covered ${type}`]);

(async function main() {
    const cardDb = await readCardDb();
    console.log(`Loaded [${Object.keys(cardDb).length}] cards from card database`);

    const allGroupIds = Object.keys(cardDb).map(Number);
    console.log("LOADING COLLECTION");
    const collectionData = await loadCollectionData();

    // Validate cards against database>
    validateCards(collectionData.cards, allGroupIds);

    // Enrich cards with database data and process them
    collectionData.cards = enrichCardsWithDbData(collectionData.cards, cardDb);
    collectionData.cards = processCardData(collectionData.cards, BASIC);
    const oracleMap = oracleDataMap();
    collectionData.cards.forEach((card) => {
        const id = strip(card.name);
        let oracle = oracleMap.get(id);
        if (!oracle) {
            // try without `a_` prefix
            oracle = oracleMap.get(id.replace(/^a_/, ""));
        }
        if (oracle) {
            card.oracle = oracle;
        } else {
            console.warn(`No oracle data found for card: ${card.name} (id: ${id})`);
        }
    });

    // Generate and write CSV files
    writeCsvFiles(collectionData.cards);

    // Before saving arena collection, load omenpath cards and add them to collection

    const arenaCollection = Object.values(
        [
            ...collectionData.cards,
            ...BASIC.map((name) => ({
                name,
                owned: 4,
            })),
        ].reduce((map, { name, owned }) => {
            map[name] = map[name] ?? { n: strip(name), o: 0 };
            map[name].o += owned;
            map[name].o = Math.min(map[name].o, 4);
            return map;
        }, {}),
    );

    const mappedCards = arenaCollection
        .filter((card) => OMENPATH_MAP.has(card.n))
        .map((card) => ({
            n: OMENPATH_MAP.get(card.n).mtg_name,
            o: card.o,
        }));
    console.log(`Added [${mappedCards.length}] omenpath cards to arena collection`);
    arenaCollection.push(...mappedCards);

    writeToData(
        `[\n${arenaCollection
            .sort((a, b) => a.n.localeCompare(b.n))
            .map((card) => JSON.stringify(card))
            .join(",\n")}\n]`,
        "arena_collection.json",
    );
})();
