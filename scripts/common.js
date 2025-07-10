import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SORT_STRING = (s1, s2) => s1.localeCompare(s2);
const SORT_BY_VALUE = (o1, o2, k) => SORT_STRING(o1[k], o2[k]);

export const mapBy = (arr, id) =>
    arr.reduce((a, c) => {
        a[c[id]] = c;
        return a;
    }, {});

export const SLASHES = {
    akr: 3,
    akh: 3,
    grn: 2,
    rna: 2,
};

export const strip = (s) => normalize(s)?.split("/")[0]?.trim().replace(/\W+/g, "_").toLowerCase();
export const normalize = (s) => s?.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const colors = "WUBGR".split("");
export const colorIdentity = (color_identity) =>
    color_identity
        .sort((a, b) => colors.indexOf(a) - colors.indexOf(b))
        .join("")
        .trim() || undefined;

const formats = {
    arena: ["standard", "historic", "timeless", "explorer", "standardbrawl", "brawl", "alchemy"],
    illegal: ["commander", "paupercommander", "oathbreaker", "duel"],
};

export const sets = {
    straightToModern: "mh1,mh2,ltr,mh3,acr".split(","),
};

export const onArena = ({ legalities }) =>
    Object.entries(legalities).some(([format, legality]) => formats.arena.includes(format));

export const modernLegal = (legalities) =>
    Object.entries(legalities).some(
        ([format, legality]) => legality == "legal" && format == "modern",
    );

const normalizeWeights = (weights) => {
    const totalWeight = Object.values(weights).reduce((sum, { weight }) => sum + weight, 0);
    return Object.fromEntries(
        Object.entries(weights).map(([key, { max, weight }]) => [
            key,
            { max, normalizedWeight: weight / totalWeight },
        ]),
    );
};

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

// Data directory helpers
const dataDir = path.join(path.dirname(new URL(import.meta.url).pathname), "../data");
export const getDataFilePath = (filename) => path.join(dataDir, filename);

export function ensureDataDir() {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

export function readDataFile(filename) {
    return JSON.parse(fs.readFileSync(getDataFilePath(filename)));
}

export function writeDataFile(filename, data, cb) {
    ensureDataDir();
    fs.writeFile(getDataFilePath(filename), data, cb);
}

export const legalCards = (card) =>
    Object.entries(card.legalities).some(
        ([format, legality]) => !formats.illegal.includes(format) && legality != "not_legal",
    );

export const loadFile = (startName, extension, dir = "") => {
    // Use ../data as default, ../Raw if dir === 'Raw'
    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    let targetDir;
    if (dir === "Raw") {
        targetDir = path.join(scriptDir, "../Raw");
    } else if (dir) {
        targetDir = path.join(scriptDir, "../data", dir);
    } else {
        targetDir = path.join(scriptDir, "../data");
    }
    const files = fs.readdirSync(targetDir).reverse();
    const found = files.find(
        (file) =>
            path.parse(file).name.startsWith(startName) &&
            path.parse(file).ext.slice(1) === extension,
    );
    if (!found) {
        throw new Error(
            `No file found for startName='${startName}', extension='${extension}' in '${targetDir}'`,
        );
    }
    return path.join(targetDir, found);
};

export const shrink = (scryfallData) => scryfallData.filter((c) => c.games.includes("arena"));

export const defaultData = () => JSON.parse(fs.readFileSync(loadFile("default-cards-", "json")));
export const oracleData = () => JSON.parse(fs.readFileSync(loadFile("oracle-cards-", "json")));

export const oracleDataMap = () => {
    const data = oracleData();
    if (!data || !Array.isArray(data)) {
        throw new Error("Invalid oracle data format");
    }
    return data.filter(onArena).reduce((map, card) => {
        map.set(strip(card.name), card);
        return map;
    }, new Map());
};

export const read = (filePath) => fs.readFileSync(filePath);
export const write = (data, filePath) => fs.writeFileSync(filePath, data);

export const getDataDir = () => {
    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    return path.join(scriptDir, "../data");
};

export const writeToData = (data, filename) => {
    const filePath = path.join(getDataDir(), filename);
    write(data, filePath);
    return filePath;
};
