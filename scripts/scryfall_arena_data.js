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
            id: card.id
        };
    }

    return baseData;
}

console.time("shrunkData");
const shrunkData = filtered.map((card) => mapCardData(card));
console.timeEnd("shrunkData");

const shrunkString = JSON.stringify(shrunkData);

const OUTPUT_FILES = {
    SHRUNK: "scryfall_arena_data.json",
    BAREBONE: "scryfall_barebone.json",
};

writeToData(shrunkString, OUTPUT_FILES.SHRUNK);

console.time("bareboneData");
const bareboneData = filtered.map((card) => mapCardData(card, true));
console.timeEnd("bareboneData");

const bareboneString = JSON.stringify(bareboneData);

writeToData(bareboneString, OUTPUT_FILES.BAREBONE);
