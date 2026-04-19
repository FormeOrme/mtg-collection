import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { defaultData, buildArenaSets } from "./common.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

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
 * Checks if this specific card printing exists on Arena.
 * This must be based on the printing itself, not format legalities.
 * @param {Object} card - The card object
 * @returns {boolean} True when this exact printing is available on Arena
 */
function isArenaPrinting(card) {
    return Array.isArray(card.games) && card.games.includes("arena");
}

/**
 * Checks whether a set is a token set.
 * @param {{set_type?: string}} setMeta - Set metadata
 * @returns {boolean} True when set_type is token
 */
function isTokenSet(setMeta) {
    return setMeta?.set_type === "token";
}

/**
 * Compares collector numbers, supporting numeric and alphanumeric forms (e.g. 12, 12a).
 * @param {string} left
 * @param {string} right
 * @returns {number}
 */
function compareCollectorNumbers(left, right) {
    const normalize = (value) => {
        const raw = String(value || "0").trim();
        const match = raw.match(/^(\d+)([a-zA-Z]*)$/);
        if (match) {
            return {
                number: parseInt(match[1], 10),
                suffix: match[2].toLowerCase(),
                raw,
            };
        }

        const numeric = parseInt(raw, 10);
        if (!Number.isNaN(numeric)) {
            return {
                number: numeric,
                suffix: "",
                raw,
            };
        }

        return {
            number: Number.MAX_SAFE_INTEGER,
            suffix: "",
            raw: raw.toLowerCase(),
        };
    };

    const a = normalize(left);
    const b = normalize(right);

    if (a.number !== b.number) {
        return a.number - b.number;
    }

    if (a.suffix !== b.suffix) {
        return a.suffix.localeCompare(b.suffix);
    }

    return a.raw.localeCompare(b.raw, undefined, { numeric: true, sensitivity: "base" });
}

/**
 * Gets a comparable release timestamp for a set code.
 * @param {Map<string, {released_at?: string}>} scryfallSets
 * @param {string} code
 * @returns {number}
 */
function getSetReleaseTimestamp(scryfallSets, code) {
    const releasedAt = scryfallSets.get(code)?.released_at;
    const ts = releasedAt ? Date.parse(releasedAt) : NaN;
    return Number.isNaN(ts) ? 0 : ts;
}

/**
 * Gets cards for a specific set
 * @param {string} setCode - The set code
 * @returns {Promise<Array>} Array of cards for that set, sorted by collector number with same-name cards grouped together
 */
async function getCardsBySet(setCode) {
    const rawCards = defaultData();
    const scryfallSets = await fetchScryfallSets();
    const selectedSetCards = [];
    const allCandidateCards = [];

    const requestedSet = scryfallSets.get(setCode);
    if (!requestedSet || isTokenSet(requestedSet)) {
        return [];
    }

    for (const card of rawCards) {
        const cardSet = scryfallSets.get(card.set);
        if (!cardSet || isTokenSet(cardSet)) {
            continue;
        }

        // Keep only Arena printings and skip basic lands.
        if (!isArenaPrinting(card) || isBasicLand(card)) {
            continue;
        }

        const imageUri = getFirstImageUri(card);
        if (!imageUri) {
            continue;
        }

        const normalizedCard = {
            name: card.name,
            set: card.set,
            image_uri: imageUri,
            rarity: card.rarity || "unknown",
            collector_number: card.collector_number || "0",
            scryfall_uri: card.scryfall_uri,
        };

        allCandidateCards.push(normalizedCard);

        if (card.set === setCode) {
            selectedSetCards.push(normalizedCard);
        }
    }

    if (selectedSetCards.length === 0) {
        return [];
    }

    const selectedNames = new Set(selectedSetCards.map((card) => card.name));

    // Keep selected set card number as main ordering anchor per name.
    const groupAnchorByName = new Map();
    for (const card of selectedSetCards) {
        const currentAnchor = groupAnchorByName.get(card.name);
        if (!currentAnchor || compareCollectorNumbers(card.collector_number, currentAnchor) < 0) {
            groupAnchorByName.set(card.name, card.collector_number);
        }
    }

    const orderedNames = [...selectedNames].sort((leftName, rightName) => {
        const anchorLeft = groupAnchorByName.get(leftName) || "0";
        const anchorRight = groupAnchorByName.get(rightName) || "0";
        const byAnchor = compareCollectorNumbers(anchorLeft, anchorRight);
        if (byAnchor !== 0) {
            return byAnchor;
        }
        return leftName.localeCompare(rightName, undefined, { sensitivity: "base" });
    });

    const cardsByName = new Map();
    for (const card of allCandidateCards) {
        if (!selectedNames.has(card.name)) {
            continue;
        }
        if (!cardsByName.has(card.name)) {
            cardsByName.set(card.name, []);
        }
        cardsByName.get(card.name).push(card);
    }

    const output = [];
    for (const name of orderedNames) {
        const group = cardsByName.get(name) || [];

        const chosenSetPrintings = group
            .filter((card) => card.set === setCode)
            .sort((a, b) => compareCollectorNumbers(a.collector_number, b.collector_number));

        const otherSetPrintings = group
            .filter((card) => card.set !== setCode)
            .sort((a, b) => {
                const byRelease =
                    getSetReleaseTimestamp(scryfallSets, b.set) -
                    getSetReleaseTimestamp(scryfallSets, a.set);
                if (byRelease !== 0) {
                    return byRelease;
                }

                const bySetCode = (a.set || "").localeCompare(b.set || "");
                if (bySetCode !== 0) {
                    return bySetCode;
                }

                return compareCollectorNumbers(a.collector_number, b.collector_number);
            });

        output.push(...chosenSetPrintings, ...otherSetPrintings);
    }

    return output;
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
