import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { getCardsBySet, buildArenaSets } from "../lib/cardUtils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

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
