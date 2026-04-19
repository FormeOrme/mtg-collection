import { defaultData } from "./common.js";

// Cache for Scryfall sets data
let scryfallSetsCache = null;

/**
 * Fetches set metadata from Scryfall API
 * @returns {Promise<Map<string, {code, name, icon_svg_uri, released_at, set_type}>>}
 */
async function fetchScryfallSets() {
    if (scryfallSetsCache) {
        return scryfallSetsCache;
    }

    const url = "https://api.scryfall.com/sets";
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Scryfall API error: ${response.statusText}`);
    }
    const data = await response.json();
    const setsMap = new Map();
    for (const set of data.data) {
        setsMap.set(set.code, {
            code: set.code,
            name: set.name,
            icon_svg_uri: set.icon_svg_uri,
            released_at: set.released_at,
            set_type: set.set_type,
        });
    }
    scryfallSetsCache = setsMap;
    return setsMap;
}

/**
 * Checks whether a set is a token set.
 * @param {{set_type?: string}} setMeta - Set metadata
 * @returns {boolean} True when set_type is token
 */
function isTokenSet(setMeta) {
    return setMeta?.set_type === "token";
}

/**
 * Extracts the first image URI from a card
 * @param {Object} card - The card object
 * @returns {string|null} The image URI or null if not found
 */
function getFirstImageUri(card) {
    // If card has card_faces (multi-face card), use first face
    if (card.card_faces && card.card_faces.length > 0) {
        const firstFace = card.card_faces[0];
        if (firstFace.image_uris?.normal) {
            return firstFace.image_uris.normal;
        }
    }
    // Otherwise use the card's image_uris
    if (card.image_uris?.normal) {
        return card.image_uris.normal;
    }
    return null;
}

/**
 * Checks if a card is a basic land (including snow lands)
 * @param {Object} card - The card object
 * @returns {boolean} True if the card is a basic land
 */
function isBasicLand(card) {
    const typeLine = card.type_line || "";
    // Check for "Basic Land" or "Basic Snow Land" patterns
    return typeLine.includes("Basic") && typeLine.includes("Land");
}

/**
 * Checks if this specific card printing exists on Arena.
 * This must be based on the printing itself, not format legalities.
 * @param {Object} card - The card object
 * @returns {boolean} True when this exact printing is available on Arena
 */
function isArenaPrinting(card) {
    return Array.isArray(card.games) && card.games.includes("arena");
}

/**
 * Normalizes a collector number token into sortable components.
 * Numeric prefixes are parsed into number, optional alpha suffix is lowercased,
 * and non-numeric values are pushed to the end using Number.MAX_SAFE_INTEGER.
 * @param {string|number|null|undefined} value - Raw collector number value.
 * @returns {{number: number, suffix: string, raw: string}} Normalized sort payload.
 */
function normalize(value) {
    const raw = String(value || "0").trim();
    const match = raw.match(/^(\d+)([a-zA-Z]*)$/);
    if (match) {
        return {
            number: parseInt(match[1], 10),
            suffix: match[2].toLowerCase(),
            raw,
        };
    }

    const numeric = parseInt(raw, 10);
    if (!Number.isNaN(numeric)) {
        return {
            number: numeric,
            suffix: "",
            raw,
        };
    }

    return {
        number: Number.MAX_SAFE_INTEGER,
        suffix: "",
        raw: raw.toLowerCase(),
    };
}

/**
 * Compares collector numbers, supporting numeric and alphanumeric forms (e.g. 12, 12a).
 * @param {string} left
 * @param {string} right
 * @returns {number}
 */
function compareCollectorNumbers(left, right) {
    const a = normalize(left);
    const b = normalize(right);

    if (a.number !== b.number) {
        return a.number - b.number;
    }

    if (a.suffix !== b.suffix) {
        return a.suffix.localeCompare(b.suffix);
    }

    return a.raw.localeCompare(b.raw, undefined, { numeric: true, sensitivity: "base" });
}

/**
 * Gets a comparable release timestamp for a set code.
 * @param {Map<string, {released_at?: string}>} scryfallSets
 * @param {string} code
 * @returns {number}
 */
function getSetReleaseTimestamp(scryfallSets, code) {
    const releasedAt = scryfallSets.get(code)?.released_at;
    const ts = releasedAt ? Date.parse(releasedAt) : NaN;
    return Number.isNaN(ts) ? 0 : ts;
}

/**
 * Builds Arena sets list with metadata
 * @returns {Promise<Array>} Array of sets with metadata and card counts
 */
export async function buildArenaSets() {
    const rawCards = defaultData();
    const scryfallSets = await fetchScryfallSets();

    const cardsBySet = {};
    const setCodesWithCards = new Set();

    // Filter and group Arena cards by set
    for (const card of rawCards) {
        const scryfallSet = scryfallSets.get(card.set);
        if (!scryfallSet || isTokenSet(scryfallSet)) {
            continue;
        }

        // Check if this specific printing is available on Arena
        if (!isArenaPrinting(card)) {
            continue;
        }

        // Skip basic lands
        if (isBasicLand(card)) {
            continue;
        }

        const imageUri = getFirstImageUri(card);
        if (!imageUri) {
            continue;
        }

        if (!cardsBySet[card.set]) {
            cardsBySet[card.set] = [];
        }

        cardsBySet[card.set].push({
            name: card.name,
            image_uri: imageUri,
            rarity: card.rarity || "unknown",
        });

        setCodesWithCards.add(card.set);
    }

    // Build sets array with metadata
    const sets = [];
    for (const setCode of setCodesWithCards) {
        const scryfallSet = scryfallSets.get(setCode);
        if (scryfallSet) {
            sets.push({
                code: setCode,
                name: scryfallSet.name,
                icon_svg_uri: scryfallSet.icon_svg_uri,
                released_at: scryfallSet.released_at,
                card_count: cardsBySet[setCode].length,
            });
        }
    }

    // Sort sets by released_at descending (most recent first)
    sets.sort((a, b) => {
        const dateA = new Date(a.released_at);
        const dateB = new Date(b.released_at);
        return dateB - dateA;
    });

    return sets;
}

/**
 * Gets cards for a specific set
 * @param {string} setCode - The set code
 * @returns {Promise<Array>} Array of cards for that set, sorted by collector number with same-name cards grouped together
 */
export async function getCardsBySet(setCode) {
    const rawCards = defaultData();
    const scryfallSets = await fetchScryfallSets();
    const selectedSetCards = [];
    const allCandidateCards = [];

    const requestedSet = scryfallSets.get(setCode);
    if (!requestedSet || isTokenSet(requestedSet)) {
        return [];
    }

    for (const card of rawCards) {
        const cardSet = scryfallSets.get(card.set);
        if (!cardSet || isTokenSet(cardSet)) {
            continue;
        }

        // Keep only Arena printings and skip basic lands.
        if (!isArenaPrinting(card) || isBasicLand(card)) {
            continue;
        }

        const imageUri = getFirstImageUri(card);
        if (!imageUri) {
            continue;
        }

        const normalizedCard = {
            name: card.name,
            set: card.set,
            image_uri: imageUri,
            rarity: card.rarity || "unknown",
            collector_number: card.collector_number || "0",
            scryfall_uri: card.scryfall_uri,
        };

        allCandidateCards.push(normalizedCard);

        if (card.set === setCode) {
            selectedSetCards.push(normalizedCard);
        }
    }

    if (selectedSetCards.length === 0) {
        return [];
    }

    const selectedNames = new Set(selectedSetCards.map((card) => card.name));

    // Keep selected set card number as main ordering anchor per name.
    const groupAnchorByName = new Map();
    for (const card of selectedSetCards) {
        const currentAnchor = groupAnchorByName.get(card.name);
        if (!currentAnchor || compareCollectorNumbers(card.collector_number, currentAnchor) < 0) {
            groupAnchorByName.set(card.name, card.collector_number);
        }
    }

    const orderedNames = [...selectedNames].sort((leftName, rightName) => {
        const anchorLeft = groupAnchorByName.get(leftName) || "0";
        const anchorRight = groupAnchorByName.get(rightName) || "0";
        const byAnchor = compareCollectorNumbers(anchorLeft, anchorRight);
        if (byAnchor !== 0) {
            return byAnchor;
        }
        return leftName.localeCompare(rightName, undefined, { sensitivity: "base" });
    });

    const cardsByName = new Map();
    for (const card of allCandidateCards) {
        if (!selectedNames.has(card.name)) {
            continue;
        }
        if (!cardsByName.has(card.name)) {
            cardsByName.set(card.name, []);
        }
        cardsByName.get(card.name).push(card);
    }

    const output = [];
    for (const name of orderedNames) {
        const group = cardsByName.get(name) || [];

        const chosenSetPrintings = group
            .filter((card) => card.set === setCode)
            .sort((a, b) => compareCollectorNumbers(a.collector_number, b.collector_number));

        const otherSetPrintings = group
            .filter((card) => card.set !== setCode)
            .sort((a, b) => {
                const byRelease =
                    getSetReleaseTimestamp(scryfallSets, b.set) -
                    getSetReleaseTimestamp(scryfallSets, a.set);
                if (byRelease !== 0) {
                    return byRelease;
                }

                const bySetCode = (a.set || "").localeCompare(b.set || "");
                if (bySetCode !== 0) {
                    return bySetCode;
                }

                return compareCollectorNumbers(a.collector_number, b.collector_number);
            });

        output.push(...chosenSetPrintings, ...otherSetPrintings);
    }

    return output;
}
