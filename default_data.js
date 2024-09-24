const axios = require('axios');
const oboe = require('oboe');
const fs = require('fs');
const cliProgress = require('cli-progress');

const avgSize = 4600;

// Function to fetch bulk data
function fetchBulkData() {
    return axios.get('https://api.scryfall.com/bulk-data')
        .then(response => {
            const bulkData = response.data;

            // Find the URL for the default_cards data
            const defaultCards = bulkData.data.find(item => item.type === 'oracle_cards');
            if (!defaultCards) {
                throw new Error('Default cards data not found');
            }

            return {
                url: defaultCards.download_uri,
                totalSize: defaultCards.size // Total size of the data in bytes
            };
        })
        .catch(error => {
            console.error('Error fetching bulk data:', error.message);
            throw error;
        });
}

// Function to download and process the default_cards data with a progress bar
function processDefaultCards(url, totalSize) {
    return new Promise((resolve, reject) => {
        const writeStream = fs.createWriteStream('card_ids.json');

        writeStream.write('[\n'); // Start the JSON array
        
        let isFirst = true;
        let processedCards = 0;

        // Initialize the progress bar with an indeterminate mode (no fixed total)
        const progressBar = new cliProgress.SingleBar({
            format: 'Processing Cards |{bar}| {value} cards processed',
            hideCursor: true
        }, cliProgress.Presets.shades_classic);

        progressBar.start(totalSize, 0); // Start the progress bar

        oboe(url)
            .node('!.*', card => {
                if (!isFirst) {
                    writeStream.write(',\n');
                }
                isFirst = false;

                // Write the card id to the file
                writeStream.write(JSON.stringify({ id: card.id }));

                // Update progress
                processedCards++;
                progressBar.increment(); // Increment the progress bar
            })
            .done(() => {
                // End the JSON array and close the stream
                writeStream.write('\n]');
                writeStream.end();
                progressBar.stop();
                console.log(`Processing complete. ${processedCards} cards processed and saved to card_ids.json`);
                resolve();
            })
            .fail(error => {
                writeStream.end(); // Ensure the stream is closed on error
                progressBar.stop();
                console.error('Error processing cards:', error);
                reject(error);
            });
    });
}

// Main function to execute the tasks using promises
function main() {
    fetchBulkData()
        .then(({ url, totalSize }) => processDefaultCards(url, totalSize/avgSize))
        .catch(error => {
            console.error('Error in main function:', error.message);
        });
}

// Execute the script
main();
