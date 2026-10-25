import fs from "fs";
import {loadFile} from "./io.js";
import {strip} from "./utils.js";
import {BASIC, legalCards} from "./domain.js";
import {OracleCard} from "./OracleCard.js";

const rarityOrder = ["common", "uncommon", "rare", "mythic"];
const rarityIndex = new Map(rarityOrder.map((r, i) => [r, i]));

export const defaultData = () => JSON.parse(fs.readFileSync(loadFile("default-cards-", "json")))
    .filter(legalCards)
    .sort(byReleaseDate);

export const oracleData = () => JSON.parse(fs.readFileSync(loadFile("oracle-cards-", "json")))
    .filter(legalCards)
    .sort(byReleaseDate);

/** @type {Array|null} In-memory cache for enriched oracle cards */
let enrichedOracleCache = null;

/**
 * Loads enriched oracle card data with Arena presence from default printings.
 * Builds the data once on first call and keeps it in memory.
 * @returns {Array} Array of enriched oracle card objects
 */
export function enrichedOracleCards() {
    if (enrichedOracleCache !== null) {
        return enrichedOracleCache;
    }

    const enrichedCards = enrichedOracleData();
    const filteredCards = enrichedCards.filter(legalCards);
    filteredCards.sort(byReleaseDate);
    enrichedOracleCache = filteredCards;
    return filteredCards;
}

const byReleaseDate = (a, b) => {
    // Leverage falsy check for null/undefined
    if (!a.released_at && !b.released_at) return a.name.localeCompare(b.name);
    if (!a.released_at) return -1;
    if (!b.released_at) return 1;

    // Primary sort by date, secondary sort by name
    return a.released_at.localeCompare(b.released_at) || a.name.localeCompare(b.name);
}

class DefaultCard {
    isReprint = false;
    constructor({name, set, set_type, games, rarity, released_at}) {
        Object.assign(this, {
            name,
            setMap: {
                [set_type]: [set],
            },
            setList: new Set([set]),
            games: new Set(games),
        });
        this.rarity = new Set();
        this.setRarity(games, rarity);
        this.firstReleased = released_at;
        this.lastReleased = released_at;
    }

    merge({set, set_type, games, rarity, released_at}) {

        const setTypes = this.setMap[set_type];
        if (setTypes) {
            if (!setTypes.includes(set)) {
                setTypes.push(set);
            }
        } else {
            this.setMap[set_type] = [set];
        }

        this.setList.add(set);
        this.games = this.games.union(new Set(games));
        this.setRarity(games, rarity);
        if (released_at < this.firstReleased) {
            this.firstReleased = released_at;
        }
        if (released_at > this.lastReleased) {
            this.lastReleased = released_at;
            this.isReprint = true;
        }
    }

    isArena() {
        return this.games.has("arena");
    }

    isBasic() {
        return BASIC.some((basic) => basic.name === this.name);
    }

    lowestRarity() {
        if (!this.rarity) {
            return null;
        }
        return getLowestRarity([...this.rarity]);
    }

    setRarity(games, rarity) {
        if (rarity === "special") {
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

/**
 * Creates an array of OracleCard instances enriched with data from default printings.
 * @returns {OracleCard[]}
 */
export function enrichedOracleData() {
    const cardMap = cardDataMap();
    const oracleCards = oracleData();
    return oracleCards.map((card) => {
        const id = strip(card.name);
        const defaultCard = cardMap.get(id) ?? null;
        return new OracleCard(card, defaultCard);
    });
}