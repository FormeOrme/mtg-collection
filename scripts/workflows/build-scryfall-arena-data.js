import { oracleData, cardDataMap } from "../lib/loaders.js";
import { legalCards, onArena, modernLegal, colorIdentity, sets } from "../lib/domain.js";
import { strip } from "../lib/utils.js";
import { writeToData } from "../lib/io.js";

const rarities = { c: 0, u: 1, r: 2, m: 3 };

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
        // if a card is basic, omit sets
        const sets = scryFallCard.isBasic() ? [] : scryFallCard.sets;
        return {
            ...baseData,
            id: card.id,
            t: mainType(card),
            sets,
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
        sub: subTypePart ? subTypePart : undefined,
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

        const { oracle } = extractCardDetails(card);
        return { ...out, oracle };
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
        ...(back && { back: oracleArenaFaceMapper(card, back) }),
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
        mapFunction: oracleArenaMapper,
    },
};

for (const [key, config] of Object.entries(OUTPUT_FILES)) {
    const timeId = `${key}_data`;
    console.time(timeId);
    const mappedData = await Promise.all(oracleCards.filter(config.filter).map(config.mapFunction));

    const dataString = mappedData.map((item) => JSON.stringify(item)).join(",\n");
    writeToData(`[\n${dataString}\n]`, config.fileName);
    console.timeEnd(timeId);
}
