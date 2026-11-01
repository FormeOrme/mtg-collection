import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";

// Data directory helpers
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dataRootDir = path.join(scriptDir, "../../data");

export const DATA_PATHS = {
    ROOT: dataRootDir,
    SOURCES: path.join(dataRootDir, "sources"),
    GENERATED: path.join(dataRootDir, "generated"),
    CONFIG: path.join(dataRootDir, "config"),
    MAPPINGS: path.join(dataRootDir, "mappings"),
};

function ensureDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}
export function ensureDataDir() {
    ensureDirectory(DATA_PATHS.ROOT);
    ensureDirectory(DATA_PATHS.SOURCES);
    ensureDirectory(DATA_PATHS.GENERATED);
    ensureDirectory(DATA_PATHS.CONFIG);
    ensureDirectory(DATA_PATHS.MAPPINGS);
}

/**
 * Resolves an exact data file by name and extension. There is no prefix or
 * date fallback: snapshot filenames are stable (`default-cards.json`,
 * `oracle-cards.json`), and a missing file should fail loudly instead of
 * silently loading a stale one.
 * @param {string} name - File name without extension, e.g. `default-cards`
 * @param {string} extension - Extension without the dot, e.g. `json`
 * @param {string} [dir] - Subdirectory of `data/`, e.g. `sources`
 * @returns {string} Absolute path to the file
 */
export function loadFile(name, extension, dir = "sources") {
    const filePath = path.join(DATA_PATHS.ROOT, dir, `${name}.${extension}`);
    if (!fs.existsSync(filePath)) {
        const hint = /cards$/.test(name)
            ? " Run `npm run download:oracle-cards` to download the Scryfall snapshots."
            : "";
        throw new Error(`Missing data file: ${filePath}.${hint}`);
    }
    return filePath;
}

export function read(filePath) {
    return fs.readFileSync(filePath);
}

export function write(data, filePath) {
    return fs.writeFileSync(filePath, data);
}

export function writeToData(data, filename) {
    ensureDataDir();
    const filePath = path.join(DATA_PATHS.GENERATED, filename);
    write(data, filePath);
    return filePath;
}
