import {
    ensureDataDir,
    getDataFilePath,
    oracleData,
    legalCards,
    strip,
    onArena,
    colorIdentity,
    sets,
    writeToData,
} from "./common.js";

const rarities = { c: 0, u: 1, r: 2, m: 3 };

console.time("bareboneData");
const bareboneData = oracleData()
    .filter(legalCards)
    .map(({ name, set, rarity, color_identity, legalities, image_uris, card_faces }) => ({
        n: strip(name),
        r: rarities[rarity[0]],
        a: onArena({ legalities }) ? 1 : undefined,
        ci: colorIdentity(color_identity),
        stm: sets.straightToModern.includes(set) || undefined,
        img: image_uris?.art_crop || card_faces?.[0]?.image_uris?.art_crop || undefined,
    }));
console.timeEnd("bareboneData");

const bareboneString = JSON.stringify(bareboneData);

writeToData(bareboneString, "scryfall_barebone.json");
