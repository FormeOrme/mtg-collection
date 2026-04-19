import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { getCardsBySet, buildArenaSets, searchArenaCards } from "../lib/cardUtils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

let setsCache = null;
let setsByCode = null;

async function getSets() {
    if (!setsCache) {
        setsCache = await buildArenaSets();
        setsByCode = new Map(setsCache.map((s) => [s.code, s]));
    }
    return { sets: setsCache, byCode: setsByCode };
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
            const htmlPath = path.join(__dirname, "../../web/art_view.html");
            serveFile(htmlPath, res);
            return;
        }

        // Route: GET /<static-file> from web folder
        if (req.method === "GET" && !pathname.startsWith("/api/")) {
            const relativePath = pathname.replace(/^\/+/, "");
            const staticPath = path.join(__dirname, "../../web", relativePath);
            if (staticPath.startsWith(path.join(__dirname, "../../web"))) {
                serveFile(staticPath, res);
                return;
            }
        }

        // Route: GET /api/sets
        if (pathname === "/api/sets" && req.method === "GET") {
            const { sets } = await getSets();
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

        // Route: GET /api/search/cards?q=<query>
        if (pathname === "/api/search/cards" && req.method === "GET") {
            const query = url.searchParams.get("q") || "";
            const searchResult = await searchArenaCards({ query });
            sendJson(res, searchResult);
            return;
        }

        // Route: GET /api/set-icon/:setCode — proxies SVG from Scryfall to avoid CORS
        const setIconMatch = pathname.match(/^\/api\/set-icon\/([a-z0-9]+)$/);
        if (setIconMatch && req.method === "GET") {
            const setCode = setIconMatch[1];
            const { byCode } = await getSets();
            const svgUrl = byCode.get(setCode)?.icon_svg_uri;
            if (!svgUrl) {
                sendError(res, "Icon not found", 404);
                return;
            }
            try {
                const upstream = await fetch(svgUrl);
                if (!upstream.ok) {
                    sendError(res, "Icon not found", 404);
                    return;
                }
                const svgText = await upstream.text();
                res.writeHead(200, {
                    "Content-Type": "image/svg+xml",
                    "Cache-Control": "public, max-age=86400",
                });
                res.end(svgText);
            } catch {
                sendError(res, "Failed to fetch icon", 502);
            }
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
    console.log(`   GET  /api/search/cards - Returns fuzzy card search results`);
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
