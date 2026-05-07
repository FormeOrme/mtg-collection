import fs from "fs";
import { loadFile } from "./io.js";
import { strip } from "./utils.js";

const rarityOrder = ["common", "uncommon", "rare", "mythic"];
const rarityIndex = new Map(rarityOrder.map((r, i) => [r, i]));

export const defaultData = () => JSON.parse(fs.readFileSync(loadFile("default-cards-", "json")));
export const oracleData = () => JSON.parse(fs.readFileSync(loadFile("oracle-cards-", "json")));
const omenpathMapping = () => JSON.parse(fs.readFileSync(loadFile("omenpath_mapping", "json")));

export const OMENPATH_MAP = omenpathMapping().reduce((map, obj) => {
    const omenName = strip(obj.printed_name);
    const mtgName = strip(obj.name);
    const mapping = {
        ...obj,
        omenName,
        mtgName,
    };
    map.set(mtgName, mapping);
    map.set(omenName, mapping);
    return map;
}, new Map());

class DefaultCard {
    constructor({ name, set, games, rarity }) {
        Object.assign(this, {
            name,
            sets: new Set([set]),
            games: new Set(games),
        });
        this.rarity = new Set();
        this.setRarity(games, rarity);
    }

    merge({ set, games, rarity }) {
        this.sets.add(set);
        this.games = this.games.union(new Set(games));
        this.setRarity(games, rarity);
    }

    isArena() {
        return this.games.has("arena");
    }

    lowestRarity() {
        if (!this.rarity) {
            return null;
        }
        return getLowestRarity([...this.rarity]);
    }

    setRarity(games, rarity) {
        if (rarity == "special") {
            return;
        }
        if (!games.includes("arena")) {
            return;
        }
        this.rarity.add(rarity);
    }
}

function getLowestRarity(rarities) {
    if (rarities.length === 0) {
        return null;
    }
    return rarities.reduce((lowest, r) =>
        (rarityIndex.get(r) ?? Infinity) < (rarityIndex.get(lowest) ?? Infinity) ? r : lowest,
    );
}

/**
 * Creates a map of card names to DefaultCard instances.
 * @returns {Map<string, DefaultCard>}
 */
export function cardDataMap() {
    const data = defaultData();
    const cardMap = new Map();
    for (const card of data) {
        const id = strip(card.name);
        const defaultCard = new DefaultCard(card);
        if (cardMap.has(id)) {
            cardMap.get(id).merge(card);
        } else {
            cardMap.set(id, defaultCard);
        }
    }
    return cardMap;
}

const cardName = (name) => {
    const strippedName = strip(name);
    return OMENPATH_MAP.get(strippedName)?.omenName ?? strippedName;
};

export const oracleDataMap = () => {
    const data = oracleData();
    if (!data || !Array.isArray(data)) {
        throw new Error("Invalid oracle data format");
    }
    return data.reduce((map, card) => {
        map.set(cardName(card.name), card);
        return map;
    }, new Map());
};
