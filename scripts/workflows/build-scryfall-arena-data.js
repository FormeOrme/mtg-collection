import { oracleData, cardDataMap } from "../lib/loaders.js";
import { legalCards, onArena, modernLegal, colorIdentity, sets } from "../lib/domain.js";
import { strip } from "../lib/utils.js";
import { writeToData } from "../lib/io.js";

const rarities = { c: 0, u: 1, r: 2, m: 3 };

console.time("Loading oracle cards");
const oracleCards = oracleData();
console.log(`Found ${oracleCards.length} oracle cards.`);

const filtered = oracleCards.filter(legalCards);
console.log(`Filtered to ${filtered.length} legal cards.`);

const cardMap = cardDataMap();
console.log(`Mapped to ${cardMap.size} unique cards.`);

console.timeEnd("Loading oracle cards");

function mapCardData(card, additionalData = false) {
    const n = strip(card.name);

    const baseData = {
        n,
        r: rarities[card.rarity[0]],
        ...(modernLegal(card) && { m: 1 }),
        ci: colorIdentity(card.color_identity),
        ...(sets.straightToModern.has(card.set) && { stm: true }),
    };

    const scryFallCard = cardMap.get(n);
    if (scryFallCard?.isArena()) {
        baseData.a = 1;

        const newRarity = scryFallCard.lowestRarity();
        if (newRarity) {
            baseData.r = rarities[newRarity[0]];
        }
    }

    if (additionalData) {
        return {
            ...baseData,
            id: card.id,
            t: mainType(card),
        };
    }

    return baseData;
}

const excludeTypes = new Set(["legendary", "basic", "snow", "world", "kindred"]);

function mainType({ type_line }) {
    const { main } = getTypes({ type_line });
    const filtered = main.filter((type) => !excludeTypes.has(type));
    if (filtered.includes("creature")) return "creature";
    return filtered[0];
}

function getTypes({ type_line }) {
    const frontFaceTypeLine = type_line.split("/")[0].trim().toLowerCase();
    const [mainTypePart, subTypePart] = frontFaceTypeLine
        .split("—")
        .map((part) => part?.trim().split(" "));

    return {
        main: mainTypePart,
        sub: subTypePart ? subTypePart : [],
    };
}

function extractCardDetails({ card_faces, oracle_text }) {
    const hasFaces = card_faces?.length;
    return {
        oracle: hasFaces ? card_faces.map((face) => face.oracle_text).join(" // ") : oracle_text,
    };
}

function oracleMapper({ keep = [], map = [] }) {
    return (card) => {
        if (!card) return null;

        const out = {};

        for (const prop of keep) {
            if (!card[prop]) continue;
            out[prop] = card[prop];
        }

        for (const [prop, mapper] of Object.entries(map)) {
            if (!card[prop] || !mapper.with) continue;
            const mapped = mapper.with(card[prop]);
            if (!mapped) continue;
            out[mapper.as] = mapped;
        }

        const { oracle } = extractCardDetails(card);
        return { ...out, oracle };
    };
}

const FILTERS = {
    ALL: () => true,
    ARENA: onArena,
};

const OUTPUT_FILES = {
    SHRUNK: {
        fileName: "scryfall_arena_data.json",
        filter: FILTERS.ALL,
        mapFunction: (card) => mapCardData(card),
    },
    BAREBONE: {
        fileName: "scryfall_barebone.json",
        filter: FILTERS.ALL,
        mapFunction: (card) => mapCardData(card, true),
    },
    ORACLE: {
        fileName: "scryfall_oracle.json",
        filter: FILTERS.ALL,
        mapFunction: oracleMapper({ keep: ["id", "mana_cost", "type_line"] }),
    },
    ORACLE_ARENA: {
        fileName: "scryfall_oracle_arena.json",
        filter: FILTERS.ARENA,
        mapFunction: oracleMapper({
            keep: ["id", "mana_cost", "type_line"],
            map: { name: { as: "strip", with: (name) => strip(name) } },
        }),
    },
};

for (const [key, config] of Object.entries(OUTPUT_FILES)) {
    const timeId = `${key}_data`;
    console.time(timeId);
    const mappedData = await Promise.all(filtered.filter(config.filter).map(config.mapFunction));

    const dataString = mappedData.map((item) => JSON.stringify(item)).join(",\n");
    writeToData(`[\n${dataString}\n]`, config.fileName);
    console.timeEnd(timeId);
}
