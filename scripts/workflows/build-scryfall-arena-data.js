import {cardDataMap, oracleData} from "../lib/loaders.js";
import {colorIdentity} from "../lib/domain.js";
import {slugify} from "../lib/utils.js";
import {writeToData} from "../lib/io.js";

const rarities = {c: 0, u: 1, r: 2, m: 3};

console.time("Loading oracle cards");
const oracleCards = oracleData();
console.log(`Found ${oracleCards.length} oracle cards.`);

const cardMap = cardDataMap();
console.log(`Mapped to ${cardMap.size} unique cards.`);

console.timeEnd("Loading oracle cards");

function mapCardData(card, additionalData = false) {
    const slug = slugify(card.name);

    const baseData = {
        slug,
        r: rarities[card.rarity[0]],
        ci: colorIdentity(card.color_identity),
    };

    const scryfallCard = cardMap.get(slug);
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
            id: card.id,
            name: card.name,
            t: mainType(card),
            sets: scryfallCard.isBasic() ? undefined : [...scryfallCard.setList],
            ...baseData,
        };
    }

    return baseData;
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

const OUTPUT_FILES = {
    BAREBONE: {
        fileName: "scryfall_barebone.json",
        mapFunction: (card) => mapCardData(card, true),
        renderFunction: ({slug, ...rest}) => JSON.stringify([slug, rest])
    },
};

for (const [, {
    filter = () => true,
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
