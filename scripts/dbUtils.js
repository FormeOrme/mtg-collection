import * as common from "./common.js";
import sqlite3 from "sqlite3";

// Configuration constants
const MAX_INVALID_CARDS_TO_SHOW = 10;
const CARD_NAME_REPLACEMENTS = {
    "///": "//",
};
const SET_NAME_REPLACEMENTS = {
    "ANA": "ANB",
};

export async function readCardDb() {
    return new Promise((resolve, reject) => {
        let dbName;
        let queryPath;
        let query;

        try {
            dbName = common.loadFile("Raw_CardDatabase", "mtga", "Raw");
            console.log("Using db", dbName);

            queryPath = common.loadFile("cardDBQuery", "sql");
            query = common.read(queryPath).toString();

            if (!query.trim()) {
                console.error("SQL query is empty! Path:", queryPath);
                resolve({});
                return;
            }
        } catch (error) {
            console.error("Error loading database or query files:", error);
            reject(error);
            return;
        }

        const cardDb = new sqlite3.Database(
            dbName,
            sqlite3.OPEN_READONLY,
            (err) => {
                if (err) {
                    console.error("Database connection error:", err.message);
                    reject(err);
                    return;
                }
                console.log(`Connected to [${dbName}]`);
            },
        );

        const out = {};

        cardDb.each(
            query,
            (err, row) => {
                if (err) {
                    console.error("SQL error:", err);
                    return;
                }

                // Only add if not already exists or if current row doesn't have HTML tags
                const hasHtmlTags = row.enUS?.match(/<|>/);
                const shouldSkip = out[row.grpId] && hasHtmlTags;

                if (!shouldSkip) {
                    out[row.grpId] = row;
                }
            },
            (err) => {
                // Close database connection when done
                cardDb.close((closeErr) => {
                    if (closeErr) {
                        console.error("Error closing database:", closeErr);
                    }
                });

                if (err) {
                    console.error("Error completing database query:", err);
                    reject(err);
                } else {
                    resolve(out);
                }
            },
        );
    });
}

export function validateCards(cards, validGroupIds) {
    const invalidCards = cards.filter((card) => !validGroupIds.includes(card.grpId));
    console.warn("INVALID CARDS COUNT:", invalidCards.length);

    // Show first few invalid cards for debugging
    invalidCards.slice(0, MAX_INVALID_CARDS_TO_SHOW).forEach((card) => {
        console.warn(`Invalid card: ${card.name} (${card.grpId})`);
    });

    return invalidCards;
}

export function enrichCardsWithDbData(cards, cardDb) {
    return cards.map((card) => ({
        ...card,
        ...cardDb[card.grpId],
    }));
}

export function processCardData(cards, basicCards) {
    return cards
        .filter((card) => !basicCards.includes(card.name))
        .map((card) => {
            // Apply name transformations
            for (const [from, to] of Object.entries(CARD_NAME_REPLACEMENTS)) {
                if (card.name) {
                    card.name = card.name.replace(from, to);
                }
            }

            // Apply set transformations
            for (const [from, to] of Object.entries(SET_NAME_REPLACEMENTS)) {
                if (card.set) {
                    card.set = card.set.replace(from, to);
                }
            }

            return card;
        });
}
