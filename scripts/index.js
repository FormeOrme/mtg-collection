import * as common from "./common.js";
import * as csvUtils from "./csvUtils.js";
import * as dbUtils from "./dbUtils.js";
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
        return JSON.parse(common.read(common.loadFile("collection", "json")));
    }
    if (collection) {
        common.writeToData(
            JSON.stringify(collection),
            `collection-${csvUtils.formatYYYYMMDD(new Date())}.json`,
        );
        return collection;
    }
}

const BASIC = "Plains,Island,Swamp,Mountain,Forest,Wastes"
    .split(",")
    .flatMap((type) => [type, `Snow-Covered ${type}`]);

(async function main() {
    const cardDb = await dbUtils.readCardDb();
    console.log(`Loaded [${Object.keys(cardDb).length}] cards from card database`);

    const allGroupIds = Object.keys(cardDb).map(Number);
    console.log("LOADING COLLECTION");
    const collectionData = await loadCollectionData();

    // Validate cards against database>
    dbUtils.validateCards(collectionData.cards, allGroupIds);

    // Enrich cards with database data and process them
    collectionData.cards = dbUtils.enrichCardsWithDbData(collectionData.cards, cardDb);
    collectionData.cards = dbUtils.processCardData(collectionData.cards, BASIC);
    const oracleMap = common.oracleDataMap();
    collectionData.cards.forEach((card) => {
        const strip = common.strip(card.name);
        const oracle = oracleMap.get(strip);
        if (oracle) {
            card.oracle = oracle;
        } else {
            console.warn(`No oracle data found for card: ${card.name} (strip: ${strip})`);
        }
    });

    // Generate and write CSV files
    csvUtils.writeCsvFiles(collectionData.cards);

    const arenaCollection = Object.values(
        [
            ...collectionData.cards,
            ...BASIC.map((name) => ({
                name,
                owned: 4,
            })),
        ].reduce((map, card) => {
            map[card.name] = map[card.name] ?? { n: common.strip(card.name), o: 0 };
            map[card.name].o += card.owned;
            map[card.name].o = Math.min(map[card.name].o, 4);
            return map;
        }, {}),
    ).sort((a, b) => a.n.localeCompare(b.n));

    common.writeToData(JSON.stringify(arenaCollection), "arena_collection.json");
})();
