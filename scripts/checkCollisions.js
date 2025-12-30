import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataPath = path.join(__dirname, "..", "data", "scryfall_barebone.json");

function checkCollisions() {
    console.log("Loading data from:", dataPath);

    const rawData = fs.readFileSync(dataPath, "utf-8");
    const data = JSON.parse(rawData);

    const hashMap = new Map();
    const collisions = [];

    // Group cards by hash
    for (const card of data) {
        if (hashMap.has(card.hash)) {
            hashMap.get(card.hash).push(card);
        } else {
            hashMap.set(card.hash, [card]);
        }
    }

    // Find collisions
    for (const [hash, cards] of hashMap) {
        if (cards.length > 1) {
            collisions.push({
                hash,
                count: cards.length,
                cards: cards.map((c) => ({
                    name: c.n,
                    id: c.id,
                })),
            });
        }
    }

    // Report results
    console.log("\n=== Hash Collision Report ===\n");
    console.log("Total cards:", data.length);
    console.log("Unique hashes:", hashMap.size);
    console.log("Collisions found:", collisions.length);

    if (collisions.length > 0) {
        console.log("\n--- Collision Details ---\n");
        for (const c of collisions) {
            console.log(`Hash: ${c.hash} (${c.count} cards)`);
            for (const card of c.cards) {
                console.log(`  - ${card.name} (${card.id})`);
            }
            console.log("");
        }
    } else {
        console.log("\n✓ No collisions detected!");
    }

    return {
        totalCards: data.length,
        uniqueHashes: hashMap.size,
        collisionCount: collisions.length,
        collisions,
    };
}

checkCollisions();
