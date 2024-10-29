const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const common = require(path.join(__dirname, 'common'));

const rarities = {
    c: 0, u: 1, r: 2, m: 3
}


console.time("shrunkData")
const shrunkData = common.oracleData.filter(common.legalCards)
    .sort((c1, c2) => c1.released_at.localeCompare(c2.released_at))
    .reverse()
    .map(({ name, set, rarity, color_identity, legalities, released_at }) => ({
        n: common.strip(name),
        // simple_name: [c.name.toLowerCase(), c.name.includes("/") ? c.name.toLowerCase()?.split("/")[0] : null].filter(e => !!e).map(
        //     e => e?.trim().replace(/'/g, "")?.replace(/[\W]+/g, "-")
        // ),
        //set: c.set,
        // slashes: c.name.includes("/") ? SLASHES[c.set] : undefined,
        r: rarities[rarity[0]],
        a: common.onArena(legalities) || undefined,
        ci: common.colorIdentity(color_identity),
        stm: common.sets.straightToModern.includes(set) || undefined
    }));
console.timeEnd("shrunkData");

const shrunkFileName = "scryfall_arena_data.json";
console.log(`[${shrunkFileName}] contains [${shrunkData.length}] cards ([${shrunkData.filter(c => c.a).length}] on arena)`);
const shrunkString = JSON.stringify(shrunkData);

fs.writeFile(shrunkFileName, shrunkString, function (err) {
    if (err) console.log(err);
});

/*
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
*/