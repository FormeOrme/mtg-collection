/**
 * Wraps an oracle card with enriched data from default printings, such as Arena presence.
 */
export class OracleCard {
    /** @type {boolean} Whether this card has at least one Arena printing */
    inArena = false;

    /** @type {Set<string>} All sets this card has been printed in */
    sets = new Set();

    /** @type {string|null} The lowest rarity across Arena printings */
    lowestRarity = null;

    /**
     * @param {Object} oracleCard - Raw oracle card object from Scryfall
     * @param {Object|null} defaultCard - Merged DefaultCard from printings data, or null
     */
    constructor(oracleCard, defaultCard) {
        // Copy all oracle card fields directly
        Object.assign(this, oracleCard);

        if (defaultCard) {
            this.inArena = defaultCard.isArena();
            this.sets = new Set(defaultCard.setList);
            const rarity = defaultCard.lowestRarity();
            if (rarity) {
                this.lowestRarity = rarity;
            }
        }
    }

    /**
     * @returns {Object} Plain object representation for JSON serialization
     */
    toJSON() {
        return {
            ...this,
            sets: [...this.sets],
        };
    }
}
