const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const common = require(path.join(__dirname, 'common'));

const strip = (s) => s.split("/")[0]?.trim().replace(/\W+/g, "_").toLowerCase();

console.time("shrunkData")
const shrunkData = common.oracleData.filter(common.legalCards).map(c => ({
    n: strip(c.name),
    // simple_name: [c.name.toLowerCase(), c.name.includes("/") ? c.name.toLowerCase()?.split("/")[0] : null].filter(e => !!e).map(
    //     e => e?.trim().replace(/'/g, "")?.replace(/[\W]+/g, "-")
    // ),
    //set: c.set,
    // slashes: c.name.includes("/") ? SLASHES[c.set] : undefined,
    r: c.rarity[0],
    a: c.games.includes("arena") ? 1 : undefined
})).sort((c1, c2) => c1.n.localeCompare(c2.n));
console.timeEnd("shrunkData");

const shrunkFileName = "scryfall_arena_data.json";
console.log(`[${shrunkFileName}] contains [${shrunkData.length}] cards`);
const shrunkString = JSON.stringify(shrunkData);

fs.writeFile(shrunkFileName, shrunkString, function (err) {
    if (err) console.log(err);
});

zlib.gzip(shrunkString, (err, buffer) => {
    if (err) {
        console.log('Error compressing the data:', err);
        return;
    }
    fs.writeFile(shrunkFileName + '.gz', buffer, (err) => {
        if (err) console.log('Error writing the file:', err)
        else console.log('File successfully written and compressed.');
    });
});