import fs from "fs";
import path from "path";

// Define the normalize function
const normalize = (s) => s?.normalize("NFC");

const strip = (s) => normalize(s)?.split("/")[0]?.trim().replace(/\W+/g, "_").toLowerCase();

/**
 * Reads a JSON file, transforms it into a binary file and an index file.
 * @param {string} inputPath - Path to the input JSON file.
 * @param {string} outputDir - Directory to save the binary and index files.
 */
const transformJsonToBin = (inputPath, outputDir) => {
    // Ensure the output directory exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Read the JSON file
    const jsonData = JSON.parse(fs.readFileSync(inputPath, "utf-8"));

    console.log(`Processing ${Object.keys(jsonData).length} entries from ${inputPath}`);

    // List of attributes to keep
    const attributesToKeep = [
        "name",
        "mana_cost",
        "color_identity",
        "type_line",
        "set",
        "rarity",
        "image_uris",
        "card_faces",
        "legalities",
        "keywords",
    ];

    const invalidSetTypes = ["memorabilia", "token", "funny", "planechase"];

    const filteredEntries = Object.entries(jsonData)
        .filter(([key, value]) => {
            // Filter out entries with invalid set types
            if (invalidSetTypes.includes(value.set_type)) {
                return false;
            }
            return true;
        })
        .map(([key, value]) => {
            // Create a new object with only the specified attributes
            const filteredValue = {};
            attributesToKeep.forEach((attr) => {
                if (value[attr] !== undefined) {
                    filteredValue[attr] = value[attr];
                }
            });
            return [strip(value.name), filteredValue];
        });

    console.log(`Filtered down to ${filteredEntries.length} entries`);

    // Prepare binary data and index
    const binaryData = [];
    const index = {};

    let offset = 0;
    filteredEntries.forEach(([key, value]) => {
        const buffer = Buffer.from(JSON.stringify(value));
        binaryData.push(buffer);

        index[key] = { offset, length: buffer.length };
        offset += buffer.length;
    });

    // Write the binary file
    const binaryFilePath = path.join(outputDir, "data.bin");
    fs.writeFileSync(binaryFilePath, Buffer.concat(binaryData));

    // Write the index file
    const indexFilePath = path.join(outputDir, "index.json");
    fs.writeFileSync(indexFilePath, JSON.stringify(index));

    console.log(`Binary file created at: ${binaryFilePath}`);
    console.log(`Index file created at: ${indexFilePath}`);
};

/**
 * Finds the JSON file with the highest ascending number in its name.
 * @param {string} directory - Directory to search for files.
 * @param {string} pattern - Pattern to match files.
 * @returns {string} - The name of the latest JSON file.
 */
const findLatestJsonFile = (directory, pattern) => {
    const files = fs.readdirSync(directory);
    const matchingFiles = files.filter(
        (file) => file.startsWith(pattern.split("*")[0]) && file.endsWith(".json"),
    );

    if (matchingFiles.length === 0) {
        throw new Error(`No files matching pattern '${pattern}' found in directory '${directory}'`);
    }

    // Sort files by the number in their name in descending order
    matchingFiles.sort((a, b) => {
        const numA = parseInt(a.match(/-(\d+)\.json$/)?.[1] || "0", 10);
        const numB = parseInt(b.match(/-(\d+)\.json$/)?.[1] || "0", 10);
        return numB - numA;
    });

    return matchingFiles[0];
};

// Example usage
const inputDirectory = path.dirname(import.meta.url.replace("file:///", ""));
const inputPattern = "oracle-cards-*.json";
const latestJsonFile = findLatestJsonFile(inputDirectory, inputPattern);
const inputJsonPath = path.join(inputDirectory, latestJsonFile);
const outputDirectory = path.join(inputDirectory, "output");
transformJsonToBin(inputJsonPath, outputDirectory);
