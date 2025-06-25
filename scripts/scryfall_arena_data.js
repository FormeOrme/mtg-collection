import zlib from "zlib";
import { ensureDataDir, getDataFilePath, oracleData, legalCards, strip, onArena, modernLegal, colorIdentity, sets } from "./common.js";
import fs from "fs";

const rarities = { c: 0, u: 1, r: 2, m: 3 };

console.time("shrunkData");
const shrunkData = oracleData.filter(legalCards)
    .map(({ name, set, rarity, color_identity, legalities, oracle_text, keywords, type_line, card_faces, all_parts }) => ({
        n: strip(name),
        r: rarities[rarity[0]],
        a: onArena(legalities) ? 1 : undefined,
        m: modernLegal(legalities) ? 1 : undefined,
        ci: colorIdentity(color_identity),
        stm: sets.straightToModern.includes(set) || undefined
    }));
console.timeEnd("shrunkData");

ensureDataDir();
const shrunkFileName = getDataFilePath("scryfall_arena_data.json");
console.log(`[${shrunkFileName}] contains [${shrunkData.length}] cards ([${shrunkData.filter(c => c.a).length}] on arena)`);
const shrunkString = JSON.stringify(shrunkData);

fs.writeFileSync(shrunkFileName, shrunkString);

/*
zlib.gzip(shrunkString, (err, buffer) => {
    if (err) {
        console.log('Error compressing the data:', err);
        return;
    }
    fs.writeFileSync(shrunkFileName + '.gz', buffer);
    console.log('File successfully written and compressed.');
});
*/