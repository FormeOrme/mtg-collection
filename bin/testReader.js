import fs from 'fs';
import path from 'path';

/**
 * Reads data from a binary file using an index file.
 * @param {string} binFilePath - Path to the binary file.
 * @param {string} indexFilePath - Path to the index file.
 * @param {string} key - The key to retrieve data for.
 * @returns {object} - The data associated with the key.
 */
const readDataFromBin = (binFilePath, indexFilePath, key) => {
    // Read the index file
    const index = JSON.parse(fs.readFileSync(indexFilePath, 'utf-8'));

    if (!index[key]) {
        throw new Error(`Key '${key}' not found in index.`);
    }

    const { offset, length } = index[key];

    // Read the binary file
    const buffer = Buffer.alloc(length);
    const fd = fs.openSync(binFilePath, 'r');
    fs.readSync(fd, buffer, 0, length, offset);
    fs.closeSync(fd);

    // Parse and return the data
    return JSON.parse(buffer.toString('utf-8'));
};

// Example usage
const binFilePath = path.join(path.dirname(import.meta.url.replace('file:///', '')), 'output', 'data.bin');
const indexFilePath = path.join(path.dirname(import.meta.url.replace('file:///', '')), 'output', 'index.json');
const testKey = 'hua_tuo_honored_physician'; // Replace with an actual key from your JSON data

try {
    const data = readDataFromBin(binFilePath, indexFilePath, testKey);
    console.log(`Data for key '${testKey}':`, data);
} catch (error) {
    console.error(error.message);
}
