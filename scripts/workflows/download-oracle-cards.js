import axios from "axios";
import fs from "fs";
import path from "path";
import { DATA_PATHS, ensureDataDir } from "../lib/common.js";

const SCRYFALL_BULK_URL = "https://api.scryfall.com/bulk-data";
const FILTER_CONFIG_FILENAME = "scryfall_filter.json";
const REQUIRED_BULK_TYPES = ["oracle_cards", "default_cards"];

function loadFilterSchema() {
    const configPath = path.join(DATA_PATHS.CONFIG, FILTER_CONFIG_FILENAME);
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (!config || typeof config.fields !== "object") {
        throw new Error(`Invalid filter config in ${configPath}: expected a 'fields' object`);
    }
    return config.fields;
}

async function fetchRequiredBulkEntries() {
    const response = await axios.get(SCRYFALL_BULK_URL, {
        headers: { Accept: "application/json" },
    });
    const payload = response.data;

    if (payload?.object !== "list" || !Array.isArray(payload?.data)) {
        throw new Error("Unexpected bulk-data payload shape from Scryfall.");
    }

    const byType = new Map(payload.data.map((entry) => [entry.type, entry]));
    const missingTypes = REQUIRED_BULK_TYPES.filter((type) => !byType.get(type)?.download_uri);
    if (missingTypes.length > 0) {
        throw new Error(`Missing bulk entries with download_uri for: ${missingTypes.join(", ")}`);
    }

    return REQUIRED_BULK_TYPES.map((type) => byType.get(type));
}

function filterBySchema(value, schema) {
    if (schema === true) {
        return value;
    }

    if (!schema || typeof schema !== "object") {
        return undefined;
    }

    if (Array.isArray(value)) {
        if (schema === true) {
            return value;
        }
        if (value.length === 0) {
            return [];
        }

        if (typeof value[0] === "object" && value[0] !== null) {
            return value
                .map((item) => filterBySchema(item, schema))
                .filter((item) => item !== undefined && item !== null);
        }

        return value;
    }

    if (value === null || typeof value !== "object") {
        return undefined;
    }

    const output = {};
    for (const [key, childSchema] of Object.entries(schema)) {
        if (!(key in value)) {
            continue;
        }
        const filtered = filterBySchema(value[key], childSchema);
        if (filtered !== undefined) {
            output[key] = filtered;
        }
    }
    return output;
}

async function streamAndFilterBulkJson(inputStream, outputStream, schema) {
    const decoder = new TextDecoder("utf8");

    let sawArrayStart = false;
    let sawArrayEnd = false;
    let depth = 0;
    let inString = false;
    let escaping = false;
    let currentObject = "";

    let processedCards = 0;
    let writtenCards = 0;

    outputStream.write("[\n");

    for await (const chunk of inputStream) {
        const text = decoder.decode(chunk, { stream: true });

        for (const char of text) {
            if (!sawArrayStart) {
                if (/\s/.test(char)) {
                    continue;
                }
                if (char !== "[") {
                    throw new Error("Invalid Scryfall bulk payload: expected JSON array start.");
                }
                sawArrayStart = true;
                continue;
            }

            if (sawArrayEnd) {
                if (!/\s/.test(char)) {
                    throw new Error(
                        "Invalid Scryfall bulk payload: trailing data after array end.",
                    );
                }
                continue;
            }

            if (depth === 0) {
                if (/\s/.test(char) || char === ",") {
                    continue;
                }
                if (char === "]") {
                    sawArrayEnd = true;
                    continue;
                }
                if (char !== "{") {
                    throw new Error("Invalid Scryfall bulk payload: expected card object.");
                }

                depth = 1;
                currentObject = "{";
                inString = false;
                escaping = false;
                continue;
            }

            currentObject += char;

            if (escaping) {
                escaping = false;
                continue;
            }

            if (char === "\\" && inString) {
                escaping = true;
                continue;
            }

            if (char === '"') {
                inString = !inString;
                continue;
            }

            if (!inString) {
                if (char === "{") {
                    depth += 1;
                } else if (char === "}") {
                    depth -= 1;
                    if (depth === 0) {
                        processedCards += 1;
                        const parsedCard = JSON.parse(currentObject);
                        const filteredCard = filterBySchema(parsedCard, schema);

                        if (filteredCard && Object.keys(filteredCard).length > 0) {
                            if (writtenCards > 0) {
                                outputStream.write(",\n");
                            }
                            outputStream.write(JSON.stringify(filteredCard));
                            writtenCards += 1;
                        }

                        currentObject = "";
                    }
                }
            }
        }
    }

    const remaining = decoder.decode();
    if (remaining.trim()) {
        throw new Error("Invalid UTF-8 stream tail while reading Scryfall bulk file.");
    }

    if (!sawArrayStart || !sawArrayEnd || depth !== 0 || currentObject) {
        throw new Error("Unexpected end of Scryfall bulk stream while parsing JSON array.");
    }

    await new Promise((resolve, reject) => {
        outputStream.on("error", reject);
        outputStream.end("\n]\n", resolve);
    });

    return { processedCards, writtenCards };
}

async function downloadAndFilterBulk(entry, schema) {
    const destinationName = path.basename(new URL(entry.download_uri).pathname);
    const destinationPath = path.join(DATA_PATHS.SOURCES, destinationName);
    const temporaryDestinationPath = `${destinationPath}.tmp`;

    console.log(`Downloading ${entry.type} (${entry.updated_at}) -> ${destinationName}`);

    const response = await axios.get(entry.download_uri, {
        responseType: "stream",
        maxBodyLength: Infinity,
        timeout: 0,
    });

    const outputStream = fs.createWriteStream(temporaryDestinationPath);
    let processedCards = 0;
    let writtenCards = 0;

    try {
        const result = await streamAndFilterBulkJson(response.data, outputStream, schema);
        processedCards = result.processedCards;
        writtenCards = result.writtenCards;
        fs.renameSync(temporaryDestinationPath, destinationPath);
    } catch (error) {
        outputStream.destroy();
        if (fs.existsSync(temporaryDestinationPath)) {
            fs.unlinkSync(temporaryDestinationPath);
        }
        throw error;
    }

    console.log(
        `Finished ${entry.type}: processed ${processedCards} cards, wrote ${writtenCards} cards to ${destinationPath}`,
    );
}

async function main() {
    ensureDataDir();

    const schema = loadFilterSchema();
    const entries = await fetchRequiredBulkEntries();

    for (const entry of entries) {
        await downloadAndFilterBulk(entry, schema);
    }

    console.log("Bulk download and filtering completed.");
}

try {
    await main();
} catch (error) {
    console.error(`Bulk download workflow failed: ${error.message}`);
    process.exitCode = 1;
}
