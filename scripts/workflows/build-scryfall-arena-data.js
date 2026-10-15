import {cardDataMap, oracleData} from "../lib/loaders.js";
import {colorIdentity, onArena} from "../lib/domain.js";
import {strip} from "../lib/utils.js";
import {writeToData} from "../lib/io.js";

const rarities = {c: 0, u: 1, r: 2, m: 3};

console.time("Loading oracle cards");
const oracleCards = oracleData();
console.log(`Found ${oracleCards.length} oracle cards.`);

const cardMap = cardDataMap();
console.log(`Mapped to ${cardMap.size} unique cards.`);

console.timeEnd("Loading oracle cards");

function mapCardData(card, additionalData = false) {
    const n = strip(card.name);

    const baseData = {
        n,
        r: rarities[card.rarity[0]],
        ci: colorIdentity(card.color_identity),
    };

    const scryfallCard = cardMap.get(n);
    if (scryfallCard?.isArena()) {
        baseData.a = 1;

        const newRarity = scryfallCard.lowestRarity();
        if (newRarity) {
            baseData.r = rarities[newRarity[0]];
        }
    }

    if (additionalData) {
        // if a card is basic, omit sets
        return {
            ...baseData,
            id: card.id,
            // ...(sets.straightToModern.has(card.set) && { stm: true }),
            // ...(modernLegal(card) && { m: 1 }),
            // t: mainType(card),
            sets: scryfallCard.isBasic() ? undefined : [...scryfallCard.setList],
            // std: standardValue(scryfallCard)
        };
    }

    return baseData;
}

const STANDARD_VALUE = {
    old: new Set(['woe', 'lci', 'mkm', 'otj', 'big', 'blb', 'dsk']),
    next: new Set(['dft', 'tdm', 'fin', 'eoe', 'spm', 'om1', 'tla', 'fdn', 'ecl', 'tmt', 'sos', 'msh', 'hob', 'fra'])
}

/**
 * @param card
 * @return
 *  * 0 if the card is not in standard
 *  * 1 if the card is in standard
 *  * 2 if the card will leave standard in the next rotation
 */
function standardValue(card) {
    const inNext = hasAnyIn(STANDARD_VALUE.next, card.setList);
    const inOld = hasAnyIn(STANDARD_VALUE.old, card.setList);
    if (inNext) {
        return 2;
    }
    if (inOld) {
        return 1;
    }
    return 0;
}

function hasAnyIn(a, b) {
    if (a == null || b == null) {
        return false;
    }
    for (const item of a) {
        if (b.has(item)) return true;
    }
    return false;
}

const excludeTypes = new Set(["legendary", "basic", "snow", "world", "kindred"]);

function mainType({type_line}) {
    const {main} = getTypes({type_line});
    const filtered = main.filter((type) => !excludeTypes.has(type));
    if (filtered.includes("creature")) return "creature";
    return filtered[0];
}

function getTypes({type_line}) {
    const frontFaceTypeLine = type_line.split("/")[0].trim().toLowerCase();
    const [mainTypePart, subTypePart] = frontFaceTypeLine
        .split("—")
        .map((part) => part?.trim().split(" "));

    return {
        main: mainTypePart,
        sub: subTypePart ? subTypePart : undefined,
    };
}

function extractCardDetails({card_faces, oracle_text}) {
    const hasFaces = card_faces?.length;
    return {
        oracle: hasFaces ? card_faces.map((face) => face.oracle_text).join(" // ") : oracle_text,
    };
}

function oracleMapper({keep = [], map = []}) {
    return (card) => {
        if (!card) return null;

        const out = {};

        for (const [prop, mapper] of Object.entries(map)) {
            if (!mapper) continue;
            const mapped = mapper(card);
            if (!mapped) continue;
            out[prop] = mapped;
        }

        for (const prop of keep) {
            if (!card[prop]) continue;
            out[prop] = card[prop];
        }

        const {oracle} = extractCardDetails(card);
        return {...out, oracle};
    };
}

function oracleArenaFaceMapper(card, face = card) {
    const faceData = {
        mana_cost: face.mana_cost ?? card.mana_cost,
        colors: face.colors ?? card.colors,
        color_identity: face.color_identity ?? card.color_identity,
        keywords: (face.keywords ?? card.keywords)?.map((keyword) => keyword.toLowerCase()),
        type: getTypes(face),
        oracle: face.oracle_text?.toLowerCase(),
    };

    return Object.fromEntries(Object.entries(faceData).filter(([, value]) => !isNullish(value)));
}

function isNullish(value) {
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === "string") return value.trim() === "";
    return value === null || value === undefined;
}

function oracleArenaMapper(card) {
    const [front, back] = card.card_faces ?? [card];

    return {
        strip: strip(card.name),
        front: oracleArenaFaceMapper(card, front),
        ...(back && {back: oracleArenaFaceMapper(card, back)}),
    };
}

const FILTERS = {
    ALL: () => true,
    ARENA: onArena,
};

const OUTPUT_FILES = {
    SHRUNK: {
        fileName: "scryfall_arena_data.json",
        mapFunction: (card) => mapCardData(card),
    },
    BAREBONE: {
        fileName: "scryfall_barebone.json",
        mapFunction: (card) => mapCardData(card, true),
        renderFunction: ({n, ...rest}) => JSON.stringify([n, rest])
    },
    ORACLE: {
        fileName: "scryfall_oracle.json",
        mapFunction: oracleMapper({keep: ["id", "mana_cost", "type_line"]}),
    },
    ORACLE_ARENA: {
        fileName: "scryfall_oracle_arena.json",
        filter: FILTERS.ARENA,
        mapFunction: oracleArenaMapper,
    },
};

for (const [, {
    filter = FILTERS.ALL,
    mapFunction,
    fileName,
    renderFunction = JSON.stringify
}] of Object.entries(OUTPUT_FILES)) {
    console.time(fileName);
    const mappedData = await Promise.all(oracleCards.filter(filter).map(mapFunction));
    const dataString = mappedData.map((card) => renderFunction(card)).join(",\n");
    writeToData(`[\n${dataString}\n]`, fileName);
    console.timeEnd(fileName);
}
