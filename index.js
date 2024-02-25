/* https://github.com/frcaton/mtga-tracker-daemon */

/*
   {"object":"card","id":"2d00bab2-e95d-4296-a805-2a05e7640efb",
   "oracle_id":"022e97af-2a3a-4e13-9b6b-d34fcc8cf168","multiverse_ids":[574483],"mtgo_id":102482,
   "arena_id":82055,"tcgplayer_id":282765,"cardmarket_id":671315,"name":"Archangel of Wrath","lang":"en",
   "released_at":"2022-09-09","uri":"https://api.scryfall.com/cards/2d00bab2-e95d-4296-a805-2a05e7640efb",
   "scryfall_uri":"https://scryfall.com/card/dmu/3/archangel-of-wrath?utm_source=api","layout":"normal","highres_image":true,"image_status":"highres_scan",
   "image_uris":{"small":"https://cards.scryfall.io/small/front/2/d/2d00bab2-e95d-4296-a805-2a05e7640efb.jpg?1673306308",
   "normal":"https://cards.scryfall.io/normal/front/2/d/2d00bab2-e95d-4296-a805-2a05e7640efb.jpg?1673306308",
   "large":"https://cards.scryfall.io/large/front/2/d/2d00bab2-e95d-4296-a805-2a05e7640efb.jpg?1673306308",
   "png":"https://cards.scryfall.io/png/front/2/d/2d00bab2-e95d-4296-a805-2a05e7640efb.png?1673306308",
   "art_crop":"https://cards.scryfall.io/art_crop/front/2/d/2d00bab2-e95d-4296-a805-2a05e7640efb.jpg?1673306308",
   "border_crop":"https://cards.scryfall.io/border_crop/front/2/d/2d00bab2-e95d-4296-a805-2a05e7640efb.jpg?1673306308"},
   "mana_cost":"{2}{W}{W}","cmc":4.0,"type_line":"Creature — Angel",
   "oracle_text":"Kicker {B} and/or {R} (You may pay an additional {B} and/or {R} as you cast this spell.)\nFlying, lifelink\nWhen Archangel of Wrath enters the battlefield, if it was kicked, it deals 2 damage to any target.\nWhen Archangel of Wrath enters the battlefield, if it was kicked twice, it deals 2 damage to any target.",
   "power":"3","toughness":"4","colors":["W"],"color_identity":["B","R","W"],
   "keywords":["Kicker","Flying","Lifelink"],"legalities":{"standard":"legal","future":"legal","historic":"legal","gladiator":"legal","pioneer":"legal","explorer":"legal","modern":"legal","legacy":"legal","pauper":"not_legal","vintage":"legal","penny":"legal","commander":"legal","oathbreaker":"legal","brawl":"legal","historicbrawl":"legal","alchemy":"legal","paupercommander":"not_legal","duel":"legal","oldschool":"not_legal","premodern":"not_legal","predh":"not_legal"},
   "games":["paper","arena","mtgo"],"reserved":false,"foil":true,"nonfoil":true,"finishes":["nonfoil","foil"],"oversized":false,"promo":false,"reprint":false,
   "variation":false,"set_id":"4e47a6cd-cdeb-4b0f-8f24-cfe1a0127cb3","set":"dmu","set_name":"Dominaria United","set_type":"expansion",
   "set_uri":"https://api.scryfall.com/sets/4e47a6cd-cdeb-4b0f-8f24-cfe1a0127cb3",
   "set_search_uri":"https://api.scryfall.com/cards/search?order=set\u0026q=e%3Admu\u0026unique=prints",
   "scryfall_set_uri":"https://scryfall.com/sets/dmu?utm_source=api","rulings_uri":"https://api.scryfall.com/cards/2d00bab2-e95d-4296-a805-2a05e7640efb/rulings",
   "prints_search_uri":"https://api.scryfall.com/cards/search?order=released\u0026q=oracleid%3A022e97af-2a3a-4e13-9b6b-d34fcc8cf168\u0026unique=prints",
   "collector_number":"3","digital":false,"rarity":"rare","card_back_id":"0aeebaf5-8c7d-4636-9e82-8c27447861f7","artist":"Miguel Mercado","artist_ids":["085f314d-cd61-48e0-89d1-048e9891e4a1"],"illustration_id":"30c90d96-ee9c-46bb-b1ee-bbc1d8097de5","border_color":"black","frame":"2015","security_stamp":"oval","full_art":false,"textless":false,"booster":true,"story_spotlight":false,"edhrec_rank":16048,"penny_rank":1277,"preview":{"source":"Wizards of the Coast","source_uri":"https://www.twitch.tv/videos/1565562937","previewed_at":"2022-08-18"},"prices":{"usd":"0.19","usd_foil":"0.28","usd_etched":null,"eur":"0.22","eur_foil":"0.40","tix":"0.02"},"related_uris":{"gatherer":"https://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=574483","tcgplayer_infinite_articles":"https://infinite.tcgplayer.com/search?contentMode=article\u0026game=magic\u0026partner=scryfall\u0026q=Archangel+of+Wrath\u0026utm_campaign=affiliate\u0026utm_medium=api\u0026utm_source=scryfall","tcgplayer_infinite_decks":"https://infinite.tcgplayer.com/search?contentMode=deck\u0026game=magic\u0026partner=scryfall\u0026q=Archangel+of+Wrath\u0026utm_campaign=affiliate\u0026utm_medium=api\u0026utm_source=scryfall","edhrec":"https://edhrec.com/route/?cc=Archangel+of+Wrath"}},
*/

/*
"Count","Tradelist Count","Name"                     ,"Edition","Condition", "Language","Foil","Tags","Last Modified"             ,"Collector Number","Alter","Proxy","Purchase Price"
"1"    ,"1"              ,"Frodo, Sauron's Bane"     ,"pltr",   "Near Mint", "English", "foil",""    ,"2023-06-30 08:03:10.083000","18s",             "False","False",""
"1"    ,"1"              ,"Sheoldred, Whispering One","nph",    "Near Mint", "English", "",    ""    ,"2023-06-30 08:04:15.087000","73",              "False","False",""
*/

const fs = require('fs');
const path = require('path');
const common = require(path.join(__dirname, 'common'));
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();

const formatYYYYMMDD = date => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

const getCsvLine = c => `"${c.name}",${c.set},${c.owned}`;
const csvRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/
const csvMap = (arr) => arr.split(/\n/g).map(r => r.split(csvRegex)).reduce((a, [name, edition, count]) => { a[`${name},${edition}`] = count; return a; }, {});

function getDiff(lastCsv, newCsv) {
    const lastArr = csvMap(lastCsv);
    const newArr = csvMap(newCsv);
    const diff = [];

    Object.entries(newArr).map(([k, v]) => {
        const lastValue = lastArr[k];
        if (!!lastValue) {
            if (lastValue != v) {
                diff.push(`${k},${v - lastValue}`);
            }
        } else {
            diff.push(`${k},${v}`);
        }
    });

    console.log(`[${diff.length}] rows diff`);

    return diff.join("\n");
}

const readCardDB = new Promise(resolve => {
    const dbName = common.loadFile("Raw_CardDatabase", "mtga");
    console.log("Using db", dbName);
    const cardDB = new sqlite3.Database(dbName, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            console.error(err.message);
        }
        console.log(`Connected to [${dbName}]`);
    });
    const out = {};
    cardDB.each(common.read("cardDBQuery.sql"), (err, row) => {
        if (!(out[row.grpId] && row.enUS?.match(/<|>/))) {
            out[row.grpId] = row;
        }
    }, () => {
        resolve(out);
    });
})

const loadCollectionData = new Promise((resolve) => {
    const url = 'http://localhost:6842/cards';
    new Promise(res => axios.get(url)
        .then(response => {
            console.log(`[${url}] online`);
            return res(response?.data);
        })
        .catch(_ => res()))
        .then(coll => {
            if (coll) {
                common.write(JSON.stringify(coll), `collection-${formatYYYYMMDD(new Date())}.json`);
            }
            resolve(coll || JSON.parse(fs.readFileSync(common.loadFile("collection", "json"))))
        });
});

const SNOW = 'Snow-Covered ';
const BASIC = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'].map(c => [c, SNOW + c]).flat();

const csvHeader = `"Name","Edition","Count"`;

readCardDB.then(cardDB => {
    // console.log(cardDB);
    const allGroupIds = Object.keys(cardDB).map(Number);
    loadCollectionData.then(collectionData => {
        console.warn("INVALID CARDS COUNT:", collectionData.cards.filter(c => !allGroupIds.includes(c.grpId)).length);

        collectionData.cards = collectionData.cards
            .map(c => ({
                ...c,
                ...cardDB[c.grpId]
            }))
            .filter(c => !BASIC.includes(c.name))
            .map(c => {
                c.name = c.name.replace("///", "//");
                c.set = c.set.replace("ANA", "ANB");
                /* TODO MANAGE SET LIKE AJMP */
                return c;
            });

        // console.log(collectionData.cards.filter((c, i) => i < 10));
        common.write(JSON.stringify(collectionData.cards), "arena_collection.json");

        console.time("creating csv");
        let newCsvContent = csvHeader;
        collectionData.cards.forEach(c => {
            newCsvContent += "\n" + getCsvLine(c);
        });

        console.timeEnd("creating csv");

        const lastCsv = common.loadFile("csvToImport_", "csv");
        console.log(`Creating diff from [${lastCsv}]`);
        const lastCsvContent = fs.readFileSync(lastCsv).toString();

        const diff = csvHeader + "\n" + getDiff(lastCsvContent, newCsvContent);
        console.time("writing diff");
        common.write(diff, `diff_${formatYYYYMMDD(new Date())}.csv`);
        console.timeEnd("writing diff");

        console.time("writing csv");
        common.write(newCsvContent, `csvToImport_${formatYYYYMMDD(new Date())}.csv`);
        console.timeEnd("writing csv");
    });
});