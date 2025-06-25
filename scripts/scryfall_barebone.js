import zlib from "zlib";
import { ensureDataDir, getDataFilePath, oracleData, legalCards, strip, onArena, colorIdentity } from "./common.js";
import fs from "fs";

ensureDataDir();
const bareboneFilename = getDataFilePath("scryfall_barebone");

const base_art_url = "https://cards.scryfall.io/art_crop";

function img(image_uris, card_faces) {
    let uris = image_uris;
    if (!uris && card_faces) {
        uris = card_faces[0].image_uris;
    }
    return uris?.art_crop.replace(base_art_url, "");
}

const barebone = oracleData
    .filter(legalCards)
    .sort((c1, c2) => c1.released_at.localeCompare(c2.released_at))
    .reverse()
    .map(({ name, color_identity, rarity, image_uris, card_faces, legalities }) =>
    ({
        name,
        n: strip(name),
        r: rarity,
        ci: colorIdentity(color_identity),
        a: onArena(legalities) ? 1 : undefined,
        img: img(image_uris, card_faces)
    }));

const bareboneString = JSON.stringify(barebone);

fs.writeFileSync(bareboneFilename + ".json", bareboneString);

/* COMPRESS
zlib.gzip(bareboneString, (err, buffer) => {
    if (err) {
        console.log('Error compressing the data:', err);
        return;
    }
    fs.writeFileSync(bareboneFilename + '.json.gz', buffer);
    console.log('File successfully written and compressed.');
});
*/