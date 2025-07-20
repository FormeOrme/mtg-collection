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

const oracleCards = oracleData();
console.log(`Found ${oracleCards.length} oracle cards.`);

const filtered = oracleCards.filter(legalCards);
console.log(`Filtered to ${filtered.length} legal cards.`);

console.time("shrunkData");
const shrunkData = filtered.map(({ name, set, rarity, color_identity, legalities }) => ({
    n: strip(name),
    r: rarities[rarity[0]],
    ...(onArena(legalities) && { a: 1 }),
    ...(modernLegal(legalities) && { m: 1 }),
    ci: colorIdentity(color_identity),
    ...(sets.straightToModern.includes(set) && { stm: true }),
}));
console.timeEnd("shrunkData");

const shrunkString = JSON.stringify(shrunkData);

writeToData(shrunkString, "scryfall_arena_data.json");

console.time("bareboneData");
const bareboneData = filtered.map(
    ({ name, set, rarity, color_identity, legalities, image_uris, card_faces }) => ({
        n: strip(name),
        r: rarities[rarity[0]],
        ...(onArena(legalities) && { a: 1 }),
        ci: colorIdentity(color_identity),
        ...(sets.straightToModern.includes(set) && { stm: true }),
        ...(image_uris?.border_crop || card_faces?.[0]?.image_uris?.border_crop
            ? { img: image_uris?.border_crop || card_faces?.[0]?.image_uris?.border_crop }
            : {}),
    }),
);
console.timeEnd("bareboneData");

const bareboneString = JSON.stringify(bareboneData);

writeToData(bareboneString, "scryfall_barebone.json");
