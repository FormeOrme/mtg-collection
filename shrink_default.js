const fs = require('fs');
const path = require('path');
const common = require(path.join(__dirname, 'common'));

console.time("shrunkData")
const shrunkData = common.shrink(common.defaultData).map(c => ({
    name: c.name,
    // simple_name: [c.name.toLowerCase(), c.name.includes("/") ? c.name.toLowerCase()?.split("/")[0] : null].filter(e => !!e).map(
    //     e => e?.trim().replace(/'/g, "")?.replace(/[\W]+/g, "-")
    // ),
    //set: c.set,
    // slashes: c.name.includes("/") ? SLASHES[c.set] : undefined,
    r: c.rarity
}));
console.timeEnd("shrunkData");
console.log(`shrunkData contains [${shrunkData.length}] cards`);

const shrunkString = JSON.stringify(shrunkData);
fs.writeFile("scryfall_arena_data.json", shrunkString, function (err) {
    if (err) return console.log(err);
    // console.log(shrunkData);
});