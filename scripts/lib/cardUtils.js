import { defaultData } from "./common.js";
import { normalizeSearchText, countAlphabeticLetters, isFuzzyMatch } from "./fuzzySearch.js";

// Cache for Scryfall sets data
let scryfallSetsCache = null;
let allArenaCardsCache = null;
let cardsWithoutModernFrameCache = null;

// Sets to deprioritize when selecting fallback modern printings
const AVOID_SETS = [
    "pl23",
    "sld",
    "prm",
    "ppro",
    "who",
    "pmei",
    "wc03",
    "40k",
    "pz2",
    "wmc",
    "oc21",
    "pip",
    "v09",
    "30a",
];

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
 * Extracts the primary illustration ID from a card
 * @param {Object} card - The card object
 * @returns {string|null} The illustration ID or null
 */
function getIllustrationId(card) {
    if (card.card_faces && card.card_faces.length > 0) {
        const firstFace = card.card_faces[0];
        if (firstFace.illustration_id) {
            return firstFace.illustration_id;
        }
    }
    return card.illustration_id || null;
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
 * Picks the collector number anchor for a name-group.
 * If a preferred set is provided, it anchors on that set when available.
 * @param {Array<{set: string, collector_number: string}>} group
 * @param {string|null} preferredSetCode
 * @returns {string}
 */
function getGroupCollectorAnchor(group, preferredSetCode = null) {
    const preferredCards = preferredSetCode
        ? group.filter((card) => card.set === preferredSetCode)
        : [];

    const source = preferredCards.length > 0 ? preferredCards : group;
    if (source.length === 0) {
        return "0";
    }

    let anchor = source[0].collector_number || "0";
    for (let i = 1; i < source.length; i += 1) {
        const candidate = source[i].collector_number || "0";
        if (compareCollectorNumbers(candidate, anchor) < 0) {
            anchor = candidate;
        }
    }

    return anchor;
}

/**
 * Sorts printings inside a name-group using the same rules as set browsing.
 * @param {Array} group
 * @param {Map<string, {released_at?: string}>} scryfallSets
 * @param {string|null} preferredSetCode
 * @returns {Array}
 */
function sortNameGroupPrintings(group, scryfallSets, preferredSetCode = null) {
    const preferredPrintings = preferredSetCode
        ? group
              .filter((card) => card.set === preferredSetCode)
              .sort((a, b) => compareCollectorNumbers(a.collector_number, b.collector_number))
        : [];

    const remainingPrintings = group
        .filter((card) => !preferredSetCode || card.set !== preferredSetCode)
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

    return [...preferredPrintings, ...remainingPrintings];
}

/**
 * Shared ordering for gallery cards and search cards.
 * Groups by card name, orders groups by collector anchor, then expands printings.
 * @param {Array} cards
 * @param {Map<string, {released_at?: string}>} scryfallSets
 * @param {string|null} preferredSetCode
 * @returns {Array}
 */
function sortCardsWithSharedOrder(cards, scryfallSets, preferredSetCode = null) {
    const cardsByName = new Map();
    for (const card of cards) {
        if (!cardsByName.has(card.name)) {
            cardsByName.set(card.name, []);
        }
        cardsByName.get(card.name).push(card);
    }

    const orderedNames = [...cardsByName.keys()].sort((leftName, rightName) => {
        const anchorLeft = getGroupCollectorAnchor(
            cardsByName.get(leftName) || [],
            preferredSetCode,
        );
        const anchorRight = getGroupCollectorAnchor(
            cardsByName.get(rightName) || [],
            preferredSetCode,
        );
        const byAnchor = compareCollectorNumbers(anchorLeft, anchorRight);
        if (byAnchor !== 0) {
            return byAnchor;
        }
        return leftName.localeCompare(rightName, undefined, { sensitivity: "base" });
    });

    const output = [];
    for (const name of orderedNames) {
        const group = cardsByName.get(name) || [];
        output.push(...sortNameGroupPrintings(group, scryfallSets, preferredSetCode));
    }

    return output;
}

/**
 * Gets Arena cards that exclusively use non-standard frames on Arena.
 * A standard 2015 frame is frame === "2015" or frame === "2003" and border_color !== "borderless".
 * @returns {Promise<Array>} Array of cards
 */
export async function getCardsWithoutModernFrame() {
    if (cardsWithoutModernFrameCache) {
        return cardsWithoutModernFrameCache;
    }

    const rawCards = defaultData();
    const scryfallSets = await fetchScryfallSets();

    // Group printings by oracle_id (or name if missing)
    const cardsByOracleId = new Map();
    // Track standard 2015 frame mapping printings per oracleId
    const modernPrintingsByOracleId = new Map();
    // Track oracle_ids that have at least one standard 2015 frame mapping on Arena
    const hasStandard2015FrameArena = new Set();
    // Track oracle_ids that have at least one standard 2015 frame anywhere
    const hasStandard2015FrameAnywhere = new Set();

    for (const card of rawCards) {
        const cardSet = scryfallSets.get(card.set);
        if (!cardSet || isTokenSet(cardSet)) {
            continue;
        }

        if (isBasicLand(card)) {
            continue;
        }

        const oracleId = card.oracle_id || card.name;

        // Detail condition
        const isStandard2015 =
            (card.frame === "2015" || card.frame === "2003") && card.border_color !== "borderless";

        if (isStandard2015) {
            hasStandard2015FrameAnywhere.add(oracleId);
            if (isArenaPrinting(card)) {
                hasStandard2015FrameArena.add(oracleId);
            }

            const imageUri = getFirstImageUri(card);
            if (imageUri) {
                if (!modernPrintingsByOracleId.has(oracleId)) {
                    modernPrintingsByOracleId.set(oracleId, []);
                }
                modernPrintingsByOracleId.get(oracleId).push({
                    name: card.name,
                    set: card.set,
                    image_uri: imageUri,
                    rarity: card.rarity || "unknown",
                    collector_number: card.collector_number || "0",
                    scryfall_uri: card.scryfall_uri,
                    frame: card.frame,
                    border_color: card.border_color,
                    is_modern: true,
                    illustration_id: getIllustrationId(card),
                    _normalized_name: normalizeSearchText(card.name),
                });
            }
        }

        if (!isArenaPrinting(card)) {
            continue;
        }

        const imageUri = getFirstImageUri(card);
        if (!imageUri) {
            continue;
        }

        if (!cardsByOracleId.has(oracleId)) {
            cardsByOracleId.set(oracleId, []);
        }

        cardsByOracleId.get(oracleId).push({
            name: card.name,
            set: card.set,
            image_uri: imageUri,
            rarity: card.rarity || "unknown",
            collector_number: card.collector_number || "0",
            scryfall_uri: card.scryfall_uri,
            frame: card.frame,
            border_color: card.border_color,
            illustration_id: getIllustrationId(card),
            _normalized_name: normalizeSearchText(card.name),
        });
    }

    const pairedOutputs = [];
    for (const [oracleId, printings] of cardsByOracleId.entries()) {
        if (
            !hasStandard2015FrameArena.has(oracleId) &&
            hasStandard2015FrameAnywhere.has(oracleId)
        ) {
            const modernPrintings = modernPrintingsByOracleId.get(oracleId) || [];
            let fallbackCard = null;

            if (modernPrintings.length > 0) {
                // Get all illustration IDs used by the non-standard Arena printings across ALL sets
                const arenaIllIds = new Set(
                    printings.map((p) => p.illustration_id).filter(Boolean),
                );

                const sortedModern = [...modernPrintings].sort((a, b) => {
                    // Give priority to matching illustrations
                    const aMatchesIll = arenaIllIds.has(a.illustration_id) ? 1 : 0;
                    const bMatchesIll = arenaIllIds.has(b.illustration_id) ? 1 : 0;
                    if (aMatchesIll !== bMatchesIll) {
                        return bMatchesIll - aMatchesIll; // Match first
                    }

                    // Avoid SLD and PRM sets if possible
                    const aIsAvoided = AVOID_SETS.includes(a.set.toLowerCase()) ? 1 : 0;
                    const bIsAvoided = AVOID_SETS.includes(b.set.toLowerCase()) ? 1 : 0;
                    if (aIsAvoided !== bIsAvoided) {
                        return aIsAvoided - bIsAvoided; // Non-avoided first
                    }

                    // Avoid white borders if possible
                    const aIsWhiteBorder = a.border_color === "white" ? 1 : 0;
                    const bIsWhiteBorder = b.border_color === "white" ? 1 : 0;
                    if (aIsWhiteBorder !== bIsWhiteBorder) {
                        return aIsWhiteBorder - bIsWhiteBorder; // Non-white first
                    }

                    // Avoid masterpiece sets if possible
                    const aIsMasterpiece =
                        scryfallSets.get(a.set)?.set_type === "masterpiece" ? 1 : 0;
                    const bIsMasterpiece =
                        scryfallSets.get(b.set)?.set_type === "masterpiece" ? 1 : 0;
                    if (aIsMasterpiece !== bIsMasterpiece) {
                        return aIsMasterpiece - bIsMasterpiece; // Non-masterpiece first
                    }

                    // Give priority to 2015 frame
                    const aIs2015 = a.frame === "2015" ? 1 : 0;
                    const bIs2015 = b.frame === "2015" ? 1 : 0;
                    if (aIs2015 !== bIs2015) {
                        return bIs2015 - aIs2015; // 2015 first
                    }

                    const byRelease =
                        getSetReleaseTimestamp(scryfallSets, a.set) -
                        getSetReleaseTimestamp(scryfallSets, b.set);
                    if (byRelease !== 0) {
                        return byRelease; // Oldest goes first
                    }
                    return compareCollectorNumbers(a.collector_number, b.collector_number);
                });
                fallbackCard = sortedModern[0];
            }

            // Group by set
            const printingsBySet = new Map();
            for (const p of printings) {
                if (!printingsBySet.has(p.set)) {
                    printingsBySet.set(p.set, []);
                }
                printingsBySet.get(p.set).push(p);
            }

            // For each set, pick the lowest collector number card
            for (const setPrintings of printingsBySet.values()) {
                setPrintings.sort((a, b) =>
                    compareCollectorNumbers(a.collector_number, b.collector_number),
                );
                const primaryCard = setPrintings[0];

                if (fallbackCard) {
                    pairedOutputs.push({
                        primaryCard,
                        fallbackCard,
                    });
                }
            }
        }
    }

    pairedOutputs.sort((a, b) => {
        const releaseA = getSetReleaseTimestamp(scryfallSets, a.primaryCard.set);
        const releaseB = getSetReleaseTimestamp(scryfallSets, b.primaryCard.set);
        if (releaseA !== releaseB) {
            return releaseB - releaseA; // Newest first
        }

        const setA = a.primaryCard.set.toLowerCase();
        const setB = b.primaryCard.set.toLowerCase();
        if (setA !== setB) {
            return setA.localeCompare(setB);
        }

        const nameA = a.primaryCard.name.toLowerCase();
        const nameB = b.primaryCard.name.toLowerCase();
        return nameA.localeCompare(nameB);
    });

    const output = [];
    for (const pair of pairedOutputs) {
        output.push(pair.primaryCard);
        output.push(pair.fallbackCard);
    }

    cardsWithoutModernFrameCache = output;
    return cardsWithoutModernFrameCache;
}

/**
 * Builds and caches all Arena-searchable cards.
 * @returns {Promise<Array>}
 */
export async function getAllArenaCards() {
    if (allArenaCardsCache) {
        return allArenaCardsCache;
    }

    const rawCards = defaultData();
    const scryfallSets = await fetchScryfallSets();
    const cards = [];

    for (const card of rawCards) {
        const cardSet = scryfallSets.get(card.set);
        if (!cardSet || isTokenSet(cardSet)) {
            continue;
        }

        if (!isArenaPrinting(card) || isBasicLand(card)) {
            continue;
        }

        const imageUri = getFirstImageUri(card);
        if (!imageUri) {
            continue;
        }

        cards.push({
            name: card.name,
            set: card.set,
            image_uri: imageUri,
            rarity: card.rarity || "unknown",
            collector_number: card.collector_number || "0",
            scryfall_uri: card.scryfall_uri,
            _normalized_name: normalizeSearchText(card.name),
        });
    }

    allArenaCardsCache = cards;
    return allArenaCardsCache;
}

/**
 * Searches Arena cards using server-side fuzzy matching.
 * @param {string} query
 * @returns {Promise<{status: string, min_letters: number, letter_count: number, total_matches?: number, cards?: Array}>}
 */
export async function searchArenaCards({
    query,
    minLetters = 3,
    threshold = 2,
    maxVisibleResults = 35,
}) {
    const letterCount = countAlphabeticLetters(query);
    if (letterCount < minLetters) {
        return {
            status: "inactive",
            min_letters: minLetters,
            letter_count: letterCount,
            cards: [],
        };
    }

    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) {
        return {
            status: "inactive",
            min_letters: minLetters,
            letter_count: letterCount,
            cards: [],
        };
    }

    const cards = await getAllArenaCards();
    const matches = [];
    const matchedNames = new Set();

    for (const card of cards) {
        if (!isFuzzyMatch(normalizedQuery, card._normalized_name, threshold)) {
            continue;
        }

        matches.push(card);
        matchedNames.add(card.name);
    }

    if (matchedNames.size > maxVisibleResults) {
        return {
            status: "too_many",
            min_letters: minLetters,
            letter_count: letterCount,
            total_matches: matchedNames.size,
            total_cards: matchedNames.size,
            total_arts: matches.length,
            cards: [],
        };
    }

    if (matches.length === 0) {
        return {
            status: "no_results",
            min_letters: minLetters,
            letter_count: letterCount,
            total_matches: 0,
            total_cards: 0,
            total_arts: 0,
            cards: [],
        };
    }

    const scryfallSets = await fetchScryfallSets();
    const orderedMatches = sortCardsWithSharedOrder(matches, scryfallSets, null);

    return {
        status: "results",
        min_letters: minLetters,
        letter_count: letterCount,
        total_matches: matchedNames.size,
        total_cards: matchedNames.size,
        total_arts: orderedMatches.length,
        cards: orderedMatches.map((card) => ({
            name: card.name,
            set: card.set,
            image_uri: card.image_uri,
            rarity: card.rarity,
            collector_number: card.collector_number,
            scryfall_uri: card.scryfall_uri,
        })),
    };
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

    const candidateCards = allCandidateCards.filter((card) => selectedNames.has(card.name));
    return sortCardsWithSharedOrder(candidateCards, scryfallSets, setCode);
}
