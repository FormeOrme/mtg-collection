// This script converts the oracle-cards JSON file into a binary file using MessagePack
// and creates an index file with stripped card names as keys.

import { createWriteStream } from "fs";
import { encode } from "msgpack-lite";
import { oracleData, writeToData, strip } from "./common.js";

const binaryFilePath = "./data/bin-oracle-cards.bin";

async function convertToBinary(cards) {
    if (!Array.isArray(cards)) {
        console.error("Error: Provided cards data is not an array.");
        return;
    }

    try {
        const index = {};
        const binaryStream = createWriteStream(binaryFilePath);
        let currentOffset = 0; // Initialize offset tracker

        for (const card of cards) {
            if (!card.name) continue;

            const strippedName = strip(card.name);
            const encodedCard = encode(card);
            binaryStream.write(encodedCard);

            index[strippedName] = { offset: currentOffset, length: encodedCard.length };
            currentOffset += encodedCard.length; // Update the offset tracker
        }

        binaryStream.end();
        await new Promise((resolve) => binaryStream.on("finish", resolve));

        await writeToData(JSON.stringify(index), "bin-oracle-cards-index.json");

        console.log("Conversion complete.");
        console.log(`Binary file: ${binaryFilePath}`);
    } catch (error) {
        console.error("Error during conversion:", error);
    }
}

(async () => {
    const cards = oracleData();
    if (!Array.isArray(cards)) {
        console.error("Error: oracleData() did not return an array. Please check the data source.");
        return;
    }

    await convertToBinary(cards);
})();
