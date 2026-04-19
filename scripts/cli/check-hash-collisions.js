import { readDataFile } from "../lib/common.js";

function checkCollisions() {
    console.log("Loading data from resolver: scryfall_barebone.json");
    const data = readDataFile("scryfall_barebone.json");

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
