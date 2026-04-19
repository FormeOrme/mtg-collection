import { createWriteStream } from "fs";
import { encode } from "msgpack-lite";
import { oracleData, writeToData, strip, ensureDataDir, getDataFilePath } from "../lib/common.js";

const binaryFilePath = getDataFilePath("bin-oracle-cards.bin");

async function convertToBinary(cards) {
    if (!Array.isArray(cards)) {
        console.error("Error: Provided cards data is not an array.");
        return;
    }

    try {
        const index = {};
        ensureDataDir();
        const binaryStream = createWriteStream(binaryFilePath);
        let currentOffset = 0;

        for (const card of cards) {
            if (!card.name) continue;

            const strippedName = strip(card.name);
            const encodedCard = encode(card);
            binaryStream.write(encodedCard);

            index[strippedName] = { offset: currentOffset, length: encodedCard.length };
            currentOffset += encodedCard.length;
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
