const fs = require('fs');
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
    .map(({ name, set, collector_number, color_identity, image_uris, card_faces }) => ({ name, set, cn: collector_number, ci: color_identity.join(""), img: img(image_uris, card_faces) }))
    .sort((c1, c2) => c1.name.localeCompare(c2.name))

fs.writeFile(bareboneFilename + ".json", JSON.stringify(barebone), function (err) {
    if (err) return console.log(err);
    // console.log(shrunkData);
});
