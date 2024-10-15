const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const common = require(path.join(__dirname, 'common'));

const bareboneFilename = "scryfall_barebone";

const base_art_url = "https://cards.scryfall.io/art_crop";

function img(image_uris, card_faces) {
    let uris = image_uris;
    if (!uris && card_faces) {
        uris = card_faces[0].image_uris;
    }
    return uris?.art_crop.replace(base_art_url, "");
}

const barebone = common.oracleData
    .filter(common.legalCards)
    .sort((c1, c2) => c1.released_at.localeCompare(c2.released_at))
    .reverse()
    .map(({ name, color_identity, rarity, image_uris, card_faces, legalities }) =>
    ({
        name,
        n: common.strip(name),
        r: rarity,
        ci: common.colorIdentity(color_identity),
        a: common.onArena(legalities) ? 1 : undefined,
        img: img(image_uris, card_faces)
    }))

const bareboneString = JSON.stringify(barebone);

fs.writeFile(bareboneFilename + ".json", bareboneString, function (err) {
    if (err) return console.log(err);
});

/* COMPRESS
zlib.gzip(bareboneString, (err, buffer) => {
    if (err) {
        console.log('Error compressing the data:', err);
        return;
    }
    fs.writeFile(bareboneFilename + '.json.gz', buffer, (err) => {
        if (err) console.log('Error writing the file:', err)
        else console.log('File successfully written and compressed.');
    });
});
 */