const colors = "WUBGR".split("");

export const SLASHES = {
    akr: 3,
    akh: 3,
    grn: 2,
    rna: 2,
};

export const sets = {
    straightToModern: new Set("mh1,mh2,ltr,mh3,acr".split(",")),
};

const arenaFormats = new Set([
    "standard",
    "historic",
    "timeless",
    "explorer",
    "standardbrawl",
    "brawl",
    "alchemy",
]);

const forcedSets = new Set(["tle"]);

export const colorIdentity = (color_identity) =>
    color_identity
        .sort((a, b) => colors.indexOf(a) - colors.indexOf(b))
        .join("")
        .trim() || undefined;

export function onArena({ set, legalities }) {
    return (
        forcedSets.has(set) ||
        Object.entries(legalities).some(
            ([format, legality]) => legality !== "not_legal" && arenaFormats.has(format),
        )
    );
}

export function modernLegal({ legalities }) {
    return legalities.modern === "legal";
}

export function legalCards({ set_type, type_line, legalities }) {
    if (/memorabilia|token|double-faced|vanguard/.test(set_type)) {
        return false;
    }
    // Exclude schemes and conspiracies
    if (/Scheme|Conspiracy|Attraction|Token/.test(type_line)) {
        return false;
    }
    // Exclude cards illegal in all formats except alchemy
    if (
        Object.values(legalities).every((value) => value === "not_legal") &&
        set_type !== "alchemy"
    ) {
        return false;
    }
    return true;
}

function normalizeWeights(weights) {
    const totalWeight = Object.values(weights).reduce((sum, { weight }) => sum + weight, 0);
    return Object.fromEntries(
        Object.entries(weights).map(([key, { max, weight }]) => [
            key,
            { max, normalizedWeight: weight / totalWeight },
        ]),
    );
}

const complexityWeights = normalizeWeights({
    oracle: { max: 700, weight: 0 },
    dot: { max: 9, weight: 5 },
    rpt: { max: 70, weight: 5 },
    ability: { max: 5, weight: 1 },
    keyword: { max: 10, weight: 2 },
    type: { max: 6, weight: 0 },
    color_identity: { max: 5, weight: 0 },
});

const removeTextBetweenParentheses = (input) =>
    input
        .replace(/\(.*?\)/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();

export function calculateComplexity({
    oracle_text = "",
    keywords = [],
    color_identity = [],
    type_line = "",
    card_faces,
}) {
    if (card_faces) {
        oracle_text = card_faces.reduce((a, c) => a + c.oracle_text, "");
        type_line = card_faces.reduce((a, c) => a + " " + c.type_line, "");
    }

    oracle_text = removeTextBetweenParentheses(oracle_text);

    let dot = (oracle_text.match(/\./g) || []).length;
    const complexity = {
        oracle: oracle_text.length,
        keyword: keywords.length,
        // type: new Set(type_line.split(/\W+/).filter(Boolean)).size,
        ability: (oracle_text.match(/[\d}]:/g) || []).length,
        dot,
        rpt: dot == 0 ? 0 : Math.floor(oracle_text.length / dot),
        // color_identity: Math.max(color_identity.join("").length, 1),
    };

    const sum = +Object.entries(complexity)
        .reduce((a, [k, v]) => {
            const weight = complexityWeights[k];
            return a + Math.min(v / weight.max, 1) * weight.normalizedWeight;
        }, 0)
        .toFixed(2);

    complexity.sum = sum;

    return complexity;
}
