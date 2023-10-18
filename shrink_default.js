const fs = require('fs');
const path = require('path');

const loadFile = (startName, extension) => fs.readdirSync(__dirname)
    .reverse()
    .find(file => path.parse(file).name.startsWith(startName) && path.parse(file).ext.slice(1) === extension);

const defaultData = JSON.parse(fs.readFileSync(loadFile("oracle-cards-", "json")));

const SORT_STRING = (s1, s2) => s1.localeCompare(s2);
const SORT_BY_VALUE = (o1, o2, k) => SORT_STRING(o1[k], o2[k]);

const SLASHES = {
    "akr": 3,
    "akh": 3,
    "grn": 2,
    "rna": 2,
}

console.time("shrunkData")
const shrunkData = defaultData
    // .filter(c => !!c.arena_id)
    // .filter(c => !c.type_line.toLowerCase().includes("basic"))
    // .filter(c => c.type_line.toLowerCase().includes("teferi"))
    //.filter(c => c.games.includes("arena"))
    .filter(c =>
        c.legalities.historicbrawl == "legal"
        || c.legalities.explorer == "legal"
        || c.games.includes("arena")
        )
    .map(c => ({
        name: c.name,
        // simple_name: [c.name.toLowerCase(), c.name.includes("/") ? c.name.toLowerCase()?.split("/")[0] : null].filter(e => !!e).map(
        //     e => e?.trim().replace(/'/g, "")?.replace(/[\W]+/g, "-")
        // ),
        //set: c.set,
        // slashes: c.name.includes("/") ? SLASHES[c.set] : undefined,
        r: c.rarity
    }))
// .filter((v, i, a) => a.findIndex(v2 => (v2.name === v.name)) === i)
// .sort((o1, o2) => SORT_BY_VALUE(o1, o2, "name"));
console.timeEnd("shrunkData");
console.log(`shrunkData contains [${shrunkData.length}] cards`);

const shrunkString = JSON.stringify(shrunkData);
fs.writeFile("scryfall_arena_data.json", shrunkString, function (err) {
    if (err) return console.log(err);
    // console.log(shrunkData);
});