const fs = require('fs');
const path = require('path');
const common = require(path.join(__dirname, 'common'));

const bareboneFilename = "scryfall_barebone.json";

const base_art_url = "https://cards.scryfall.io/art_crop";

function img(image_uris, card_faces) {
    if (card_faces) {
        image_uris = card_faces[0].image_uris
    }
    return image_uris?.art_crop.replace(base_art_url, "") || "none";
}

const barebone = common.defaultData
    .filter(card => Object.values(card.legalities).some(value => value == "legal")
        && !["token", "funny", "memorabilia", "promo"].includes(card.set_type))
    .map(({ name, set, collector_number, color_identity, image_uris, card_faces }) =>
        ({ name, set, cn: collector_number, ci: color_identity.join(), img: img(image_uris, card_faces) }))
    .sort((c1, c2) => c1.name.localeCompare(c2.name))
const bareboneContent = JSON.stringify(barebone);
fs.writeFile(bareboneFilename, bareboneContent, function (err) {
    if (err) return console.log(err);
    // console.log(shrunkData);
});

 