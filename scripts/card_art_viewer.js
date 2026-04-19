import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { defaultData, onArena } from "./common.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

// Cache for Scryfall sets data
let scryfallSetsCache = null;

/**
 * Fetches set metadata from Scryfall API
 * @returns {Promise<Map<string, {code, name, icon_svg_uri, released_at}>>}
 */
async function fetchScryfallSets() {
    if (scryfallSetsCache) {
        return scryfallSetsCache;
    }

    const url = "https://api.scryfall.com/sets";
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Scryfall API error: ${response.statusText}`);
    }
    const data = await response.json();
    const setsMap = new Map();
    for (const set of data.data) {
        setsMap.set(set.code, {
            code: set.code,
            name: set.name,
            icon_svg_uri: set.icon_svg_uri,
            released_at: set.released_at,
        });
    }
    scryfallSetsCache = setsMap;
    return setsMap;
}

/**
 * Extracts the first image URI from a card
 * @param {Object} card - The card object
 * @returns {string|null} The image URI or null if not found
 */
function getFirstImageUri(card) {
    // If card has card_faces (multi-face card), use first face
    if (card.card_faces && card.card_faces.length > 0) {
        const firstFace = card.card_faces[0];
        if (firstFace.image_uris?.normal) {
            return firstFace.image_uris.normal;
        }
    }
    // Otherwise use the card's image_uris
    if (card.image_uris?.normal) {
        return card.image_uris.normal;
    }
    return null;
}

/**
 * Checks if a card is a basic land (including snow lands)
 * @param {Object} card - The card object
 * @returns {boolean} True if the card is a basic land
 */
function isBasicLand(card) {
    const typeLine = card.type_line || "";
    // Check for "Basic Land" or "Basic Snow Land" patterns
    return typeLine.includes("Basic") && typeLine.includes("Land");
}

/**
 * Builds Arena sets list with metadata
 * @returns {Promise<Array>} Array of sets with metadata and card counts
 */
async function buildArenaSets() {
    const rawCards = defaultData();
    const scryfallSets = await fetchScryfallSets();

    const cardsBySet = {};
    const setCodesWithCards = new Set();

    // Filter and group Arena cards by set
    for (const card of rawCards) {
        // Check if card is available on Arena
        if (!onArena({ set: card.set, legalities: card.legalities })) {
            continue;
        }

        // Skip basic lands
        if (isBasicLand(card)) {
            continue;
        }

        const imageUri = getFirstImageUri(card);
        if (!imageUri) {
            continue;
        }

        if (!cardsBySet[card.set]) {
            cardsBySet[card.set] = [];
        }

        cardsBySet[card.set].push({
            name: card.name,
            image_uri: imageUri,
            rarity: card.rarity || "unknown",
        });

        setCodesWithCards.add(card.set);
    }

    // Build sets array with metadata
    const sets = [];
    for (const setCode of setCodesWithCards) {
        const scryfallSet = scryfallSets.get(setCode);
        if (scryfallSet) {
            sets.push({
                code: setCode,
                name: scryfallSet.name,
                icon_svg_uri: scryfallSet.icon_svg_uri,
                released_at: scryfallSet.released_at,
                card_count: cardsBySet[setCode].length,
            });
        }
    }

    // Sort sets by released_at descending (most recent first)
    sets.sort((a, b) => {
        const dateA = new Date(a.released_at);
        const dateB = new Date(b.released_at);
        return dateB - dateA;
    });

    return sets;
}

/**
 * Gets cards for a specific set
 * @param {string} setCode - The set code
 * @returns {Promise<Array>} Array of cards for that set, sorted by collector number
 */
async function getCardsBySet(setCode) {
    const rawCards = defaultData();
    const cards = [];

    for (const card of rawCards) {
        // Check if card is in the requested set and is on Arena
        if (card.set !== setCode || !onArena({ set: card.set, legalities: card.legalities })) {
            continue;
        }

        // Skip basic lands
        if (isBasicLand(card)) {
            continue;
        }

        const imageUri = getFirstImageUri(card);
        if (!imageUri) {
            continue;
        }

        cards.push({
            name: card.name,
            image_uri: imageUri,
            rarity: card.rarity || "unknown",
            collector_number: card.collector_number || "0",
            scryfall_uri: card.scryfall_uri,
        });
    }

    // Sort cards by collector number
    cards.sort((a, b) => {
        const numA = parseInt(a.collector_number, 10);
        const numB = parseInt(b.collector_number, 10);

        // If both are valid numbers, compare numerically
        if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
        }

        // Otherwise, compare as strings
        return a.collector_number.localeCompare(b.collector_number);
    });

    return cards;
}

/**
 * Serves a file with appropriate MIME type
 */
function serveFile(filePath, res) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        ".html": "text/html",
        ".css": "text/css",
        ".js": "application/javascript",
        ".json": "application/json",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
    };

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("404 Not Found");
            return;
        }

        const mimeType = mimeTypes[ext] || "application/octet-stream";
        res.writeHead(200, { "Content-Type": mimeType });
        res.end(data);
    });
}

/**
 * Sends JSON response
 */
function sendJson(res, data, statusCode = 200) {
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
}

/**
 * Sends error response
 */
function sendError(res, message, statusCode = 500) {
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: message }));
}

/**
 * Main HTTP server
 */
const server = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Cache-Control", "no-cache");

    // Handle OPTIONS requests
    if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
    }

    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const pathname = url.pathname;

        // Route: GET /
        if (pathname === "/" && req.method === "GET") {
            const htmlPath = path.join(__dirname, "../web/art_view.html");
            serveFile(htmlPath, res);
            return;
        }

        // Route: GET /<static-file> from web folder
        if (req.method === "GET" && !pathname.startsWith("/api/")) {
            const relativePath = pathname.replace(/^\/+/, "");
            const staticPath = path.join(__dirname, "../web", relativePath);
            if (staticPath.startsWith(path.join(__dirname, "../web"))) {
                serveFile(staticPath, res);
                return;
            }
        }

        // Route: GET /api/sets
        if (pathname === "/api/sets" && req.method === "GET") {
            const sets = await buildArenaSets();
            sendJson(res, sets);
            return;
        }

        // Route: GET /api/sets/:setCode
        const setCodeMatch = pathname.match(/^\/api\/sets\/([a-z0-9]+)$/);
        if (setCodeMatch && req.method === "GET") {
            const setCode = setCodeMatch[1];
            const cards = await getCardsBySet(setCode);
            sendJson(res, cards);
            return;
        }

        // 404
        sendError(res, "Not Found", 404);
    } catch (error) {
        console.error("Server error:", error);
        sendError(res, error.message);
    }
});

server.listen(PORT, () => {
    console.log(`🎴 MTG Arena Card Art Viewer Server`);
    console.log(`📡 Server running at http://localhost:${PORT}`);
    console.log(`\n📋 Available endpoints:`);
    console.log(`   GET  /                 - Serves the web interface`);
    console.log(`   GET  /api/sets         - Returns all Arena sets with metadata`);
    console.log(`   GET  /api/sets/:code   - Returns cards for a specific set`);
    console.log(`\n✨ Open http://localhost:${PORT} in your browser`);
    console.log(`\nPress Ctrl+C to stop the server\n`);
});

server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
        console.error(`❌ Port ${PORT} is already in use`);
        console.error(
            `   Try setting PORT environment variable: PORT=3001 node scripts/card_art_viewer.js`,
        );
    } else {
        console.error(`❌ Server error:`, err.message);
    }
    process.exit(1);
});
