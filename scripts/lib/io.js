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

const READ_SEARCH_DIRS = [
    DATA_PATHS.SOURCES,
    DATA_PATHS.CONFIG,
    DATA_PATHS.MAPPINGS,
    DATA_PATHS.GENERATED,
    DATA_PATHS.ROOT,
];

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

export function loadFile(startName, extension, dir = "") {
    let targetDirs;
    if (dir === "Raw") {
        targetDirs = [path.join(scriptDir, "../../Raw")];
    } else if (dir) {
        targetDirs = [path.join(DATA_PATHS.ROOT, dir)];
    } else {
        targetDirs = READ_SEARCH_DIRS;
    }

    for (const targetDir of targetDirs) {
        if (!fs.existsSync(targetDir)) {
            continue;
        }
        const files = fs.readdirSync(targetDir).reverse();
        const found = files.find(
            (file) =>
                path.parse(file).name.startsWith(startName) &&
                path.parse(file).ext.slice(1) === extension,
        );
        if (found) {
            return path.join(targetDir, found);
        }
    }

    throw new Error(
        `No file found for startName='${startName}', extension='${extension}' in '${targetDirs.join("', '")}'`,
    );
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
