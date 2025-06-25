import { readDataFile } from "./common.js";

const oracleData = readDataFile("default-filtered.json");
const found = oracleData.filter(c => c.name.includes("Combat Th"));
console.log(`[${found.length}] Cards found`);
console.log(found);

const sets = oracleData
    .filter(c => Number.isInteger(+c.collector_number))
    .reduce((a, c) => {
        a[c.set] = (a[c.set] ?? []);
        a[c.set].push(c);
        return a;
    }, {});
Object.values(sets).forEach(v =>
    v.sort((c1, c2) => c1.collector_number - c2.collector_number)
);
const mins = Object.entries(sets).reduce((a, [k, v]) => { a[k] = v[0]; return a; }, {});
console.log(Object.values(mins).map(c => JSON.stringify(c)));

oracleData.filter(c => !!mins[c.set]).forEach(c => {
    c.arena_id_ex = mins[c.set].arena_id + (c.collector_number - mins[c.set].collector_number);
    if (c.arena_id != c.arena_id_ex) {
        c.wrong = true;
    }
});
const SET = "bro";
const filtered = oracleData
    .filter(c => c.set == SET)
    .sort((c1, c2) => c1.arena_id - c2.arena_id);
console.table(filtered);
console.log(mins[SET]);
console.log(oracleData.length, filtered.length);