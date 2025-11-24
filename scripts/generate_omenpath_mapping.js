import { defaultData, writeToData } from "./common.js";

console.time("Generate omenpath mapping");

// Load oracle cards
console.log("Loading oracle cards...");
const defaultCards = defaultData();
console.log(`Found ${defaultCards.length} cards.`);

// Filter cards that have a printed_name property
console.log("Filtering cards with printed_name...");
const omenpathCards = defaultCards
    .filter((card) => card.set === "om1")
    .filter((card) => card.printed_name || card.card_faces?.[0]?.printed_name);
console.log(`Found ${omenpathCards.length} cards with printed_name.`);

// Map to the omenpath_mapping format
const mappingData = omenpathCards.map((card) => ({
    printed_name: card.card_faces ? card.card_faces[0].printed_name : card.printed_name,
    name: card.card_faces ? card.card_faces[0].name : card.name,
    oracle_id: card.oracle_id,
}));

// Sort by printed_name for consistency
mappingData.sort((a, b) => a.printed_name.localeCompare(b.printed_name));

// Write to data folder
const outputPath = writeToData(JSON.stringify(mappingData, null, 2), "omenpath_mapping.json");
console.log(`Written ${mappingData.length} entries to ${outputPath}`);

console.timeEnd("Generate omenpath mapping");
