const fs = require('fs');
const path = require('path');
const { start } = require('repl');

const SORT_STRING = (s1, s2) => s1.localeCompare(s2);
const SORT_BY_VALUE = (o1, o2, k) => SORT_STRING(o1[k], o2[k]);

const mapBy = (arr, id) => arr.reduce((a, c) => { a[c[id]] = c; return a }, {});

const SLASHES = {
    "akr": 3,
    "akh": 3,
    "grn": 2,
    "rna": 2,
}

function err(err) {
    if (err) return console.log(err);
}

module.exports = ({
    legalCards: card => Object.values(card.legalities).some(value => value == "legal")
        && card.set_type!="funny",
    loadFile: (startName, extension, dir = "") => path.join(dir, fs.readdirSync(path.join(__dirname, dir))
        .reverse()
        .find(file => path.parse(file).name.startsWith(startName) && path.parse(file).ext.slice(1) === extension)),
    shrink: (scryfallData) => scryfallData
        // .filter(c => !!c.arena_id)
        // .filter(c => !c.type_line.toLowerCase().includes("basic"))
        // .filter(c => c.type_line.toLowerCase().includes("teferi"))
        //.filter(c => c.games.includes("arena"))
        .filter(c => c.games.includes("arena")),
    // .filter((v, i, a) => a.findIndex(v2 => (v2.name === v.name)) === i)
    // .sort((o1, o2) => SORT_BY_VALUE(o1, o2, "name"));
    write: (file, name) => fs.writeFile(name, file, err),
    read: (filePath) => fs.readFileSync(filePath, 'utf8'),
    get defaultData() {
        return JSON.parse(fs.readFileSync(this.loadFile("default-cards-", "json")))
    },
    get oracleData() {
        return JSON.parse(fs.readFileSync(this.loadFile("oracle-cards-", "json")))
    }
});