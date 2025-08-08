import {
    oracleData,
    legalCards,
    strip,
    onArena,
    modernLegal,
    colorIdentity,
    sets,
    writeToData,
} from "./common.js";

const rarities = { c: 0, u: 1, r: 2, m: 3 };

console.time("Loading oracle cards");
const oracleCards = oracleData();
console.log(`Found ${oracleCards.length} oracle cards.`);

const filtered = oracleCards.filter(legalCards);
console.log(`Filtered to ${filtered.length} legal cards.`);
console.timeEnd("Loading oracle cards");

function mapCardData(card, additionalData = false) {
    const baseData = {
        n: strip(card.name),
        r: rarities[card.rarity[0]],
        ...(onArena(card.legalities) && { a: 1 }),
        ...(modernLegal(card.legalities) && { m: 1 }),
        ci: colorIdentity(card.color_identity),
        ...(sets.straightToModern.includes(card.set) && { stm: true }),
    };

    if (additionalData) {
        return {
            ...baseData,
            id: card.id,
        };
    }

    return baseData;
}

function extractCardDetails(card) {
    const hasFaces = card.card_faces?.length;
    return {
        oracle: hasFaces
            ? card.card_faces.map((face) => face.oracle_text).join(" // ")
            : card.oracle_text,
    };
}

const OUTPUT_FILES = {
    SHRUNK: { fileName: "scryfall_arena_data.json", mapFunction: (card) => mapCardData(card) },
    BAREBONE: {
        fileName: "scryfall_barebone.json",
        mapFunction: (card) => mapCardData(card, true),
    },
    ORACLE: {
        fileName: "scryfall_oracle.json",
        mapFunction: (card) => {
            const { oracle } = extractCardDetails(card);
            return {
                id: card.id,
                // name: card.name,
                // stripId: strip(card.name),
                manaCost: card.mana_cost,
                type: card.type_line,
                oracle,
            };
        },
    },
};

Object.entries(OUTPUT_FILES).forEach(([key, config]) => {
    const timeId = `${key}_data`;
    console.time(timeId);
    const mappedData = filtered.map(config.mapFunction);

    // Convert to JSONL (NDJSON) format
    const dataString = mappedData.map((item) => JSON.stringify(item)).join(",\n");
    writeToData(`[\n${dataString}\n]`, config.fileName);
    console.timeEnd(timeId);
});
