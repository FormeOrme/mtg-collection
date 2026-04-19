import axios from "axios";
import oboe from "oboe";
import fs from "fs";
import cliProgress from "cli-progress";
import { ensureDataDir, getDataFilePath } from "../lib/common.js";

const avgSize = 4600;

async function fetchBulkData() {
    try {
        const response = await axios.get("https://api.scryfall.com/bulk-data");
        const bulkData = response.data;
        const defaultCards = bulkData.data.find((item) => item.type === "oracle_cards");
        if (!defaultCards) {
            throw new Error("Default cards data not found");
        }
        return {
            url: defaultCards.download_uri,
            totalSize: defaultCards.size,
        };
    } catch (error) {
        console.error("Error fetching bulk data:", error.message);
        throw error;
    }
}

function processDefaultCards(url, totalSize) {
    ensureDataDir();
    const writeStream = fs.createWriteStream(getDataFilePath("card_ids.json"));
    writeStream.write("[\n");
    let isFirst = true;
    let processedCards = 0;
    const progressBar = new cliProgress.SingleBar(
        {
            format: "Processing Cards |{bar}| {value} cards processed",
            hideCursor: true,
        },
        cliProgress.Presets.shades_classic,
    );
    progressBar.start(totalSize, 0);
    oboe(url)
        .node("!.*", (card) => {
            if (!isFirst) {
                writeStream.write(",\n");
            }
            isFirst = false;
            writeStream.write(JSON.stringify({ id: card.id }));
            processedCards++;
            progressBar.increment();
        })
        .done(() => {
            writeStream.write("\n]");
            writeStream.end();
            progressBar.stop();
            console.log(
                `Processing complete. ${processedCards} cards processed and saved to card_ids.json`,
            );
        })
        .fail((error) => {
            writeStream.end();
            progressBar.stop();
            console.error("Error processing cards:", error);
        });
}

async function main() {
    try {
        const { url, totalSize } = await fetchBulkData();
        await processDefaultCards(url, totalSize / avgSize);
    } catch (error) {
        console.error("Error in main function:", error.message);
    }
}

await main();
