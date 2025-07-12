import {
    ensureDataDir,
    getDataFilePath,
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

console.time("shrunkData");
const shrunkData = oracleData()
    .filter(legalCards)
    .map(
        ({
            name,
            set,
            rarity,
            color_identity,
            legalities,
            oracle_text,
            keywords,
            type_line,
            card_faces,
            all_parts,
        }) => ({
            n: strip(name),
            r: rarities[rarity[0]],
            a: onArena({ legalities }) ? 1 : undefined,
            m: modernLegal(legalities) ? 1 : undefined,
            ci: colorIdentity(color_identity),
            stm: sets.straightToModern.includes(set) || undefined,
        }),
    );
console.timeEnd("shrunkData");

const shrunkString = JSON.stringify(shrunkData);

writeToData(shrunkString, "scryfall_arena_data.json");