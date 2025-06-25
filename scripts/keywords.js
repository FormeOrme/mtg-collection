import { defaultData } from "./common.js";

const filtered = defaultData
    .filter(o => !o.oracle_text || !o.type_line.includes("Token"))
    .filter(o => o.legalities.modern == 'legal' || o.legalities.timeless == 'legal');

const keyWords = filtered
    .filter(o => o.keywords.length)
    .filter(o => !o.oracle_text || !o.oracle_text.includes("—"))
    .map(o => ([o.keywords, o.games]))
    .reduce((a, [kw, g]) => {
        if (g.includes("arena")) {
            a.arena.add(...kw);
        } else {
            a.miss.add(...kw);
        }
        return a;
    }, { arena: new Set(), miss: new Set() });

keyWords.arena.forEach(value => keyWords.miss.delete(value));
console.log(keyWords);
