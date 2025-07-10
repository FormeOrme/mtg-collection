/**
 * FileLoader class manages binary and index URLs and provides a method to retrieve data by key.
 */

export default class FileLoader {
    /**
     * Creates an instance of FileLoader.
     * @param {string} folderUrl - The base URL of the folder containing the binary and index files.
     */
    constructor(folderUrl) {
        this.binFileUrl = `${folderUrl}/data.bin`;
        this.indexFileUrl = `${folderUrl}/index.json`;
    }

    /**
     * Retrieves data from the binary file using the index file and a key.
     * @param {string} key - The key to retrieve data for.
     * @returns {Promise<object>} - A promise that resolves to the data associated with the key.
     */
    async getData(key) {
        // Fetch the index file
        const indexResponse = await fetch(this.indexFileUrl);
        if (!indexResponse.ok) {
            throw new Error(`Failed to fetch index file: ${indexResponse.statusText}`);
        }
        const index = await indexResponse.json();

        if (!index[key]) {
            throw new Error(`Key '${key}' not found in index.`);
        }

        const { offset, length } = index[key];

        // Fetch the binary file range
        const binResponse = await fetch(this.binFileUrl, {
            headers: {
                Range: `bytes=${offset}-${offset + length - 1}`,
            },
        });
        if (!binResponse.ok) {
            throw new Error(`Failed to fetch binary data: ${binResponse.statusText}`);
        }

        const arrayBuffer = await binResponse.arrayBuffer();
        const data = new TextDecoder("utf-8").decode(arrayBuffer);

        // Parse and return the data
        return JSON.parse(data);
    }

    /**
     * Retrieves data from the binary file using the index file and a list of keys.
     * @param {string[]} keys - The keys to retrieve data for.
     * @returns {Promise<object[]>} - A promise that resolves to an array of data objects associated with the keys.
     */
    async getDataList(keys) {
        const dataPromises = keys.map((key) => this.getData(key));
        return Promise.all(dataPromises);
    }
}