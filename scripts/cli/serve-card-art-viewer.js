import {Hono} from "hono";
import {cors} from "hono/cors";
import {serve} from "@hono/node-server";
import {serveStatic} from "@hono/node-server/serve-static";
import path from "path";
import {fileURLToPath} from "url";
import {
    buildArenaSets,
    getCardsBySet,
    getCardsWithoutModernFrame,
    getCardsWithNonArenaKeywords,
    getMultiRarityCards,
    parseDecklistText,
    searchArenaCards,
} from "../lib/cardUtils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDir = path.join(__dirname, "../../web");

const PORT = Number(process.env.PORT) || 3000;

let setsCache = null;
let setsByCode = null;

async function getSets() {
    if (!setsCache) {
        setsCache = await buildArenaSets();
        setsByCode = new Map(setsCache.map((s) => [s.code, s]));
    }
    return {setMap: setsCache, byCode: setsByCode};
}

const app = new Hono();

// CORS middleware
app.use("*", cors());

// API routes (must come before static file catch-all)
app.get("/api/sets", async (c) => {
    const {setMap} = await getSets();
    return c.json(setMap);
});

app.get("/api/sets/:setCode", async (c) => {
    const setCode = c.req.param("setCode");
    const cards = await getCardsBySet(setCode);
    return c.json(cards);
});

app.get("/api/search/cards", async (c) => {
    const query = c.req.query("q") || "";
    const searchResult = await searchArenaCards({query});
    return c.json(searchResult);
});

app.get("/api/cards/multi-rarity", async (c) => {
    const cards = await getMultiRarityCards();
    return c.json({cards, total_cards: cards.length});
});

app.get("/api/cards/no-2015-frame", async (c) => {
    const page = parseInt(c.req.query("page"), 10) || 1;
    const pageSize = 40;

    const allCards = await getCardsWithoutModernFrame();
    const totalItems = allCards.length;
    const nonStandardCount = allCards.filter((card) => !card.is_modern).length;
    const totalPages = Math.ceil(totalItems / pageSize);

    const startIdx = (page - 1) * pageSize;
    const paginatedCards = allCards.slice(startIdx, startIdx + pageSize);

    return c.json({
        cards: paginatedCards,
        total_cards: totalItems,
        non_standard_count: nonStandardCount,
        current_page: page,
        total_pages: totalPages,
    });
});

app.get("/api/cards/keywords-not-in-arena", async (c) => {
    const result = await getCardsWithNonArenaKeywords();
    return c.json(result);
});

app.post("/api/decklist/parse", async (c) => {
    const body = await c.req.json().catch((e) => (e instanceof SyntaxError ? {} : (() => { throw e; })()));
    const decklistText = String(body.decklist || "");

    if (!decklistText.trim()) {
        return c.json({error: "Missing decklist text"}, 400);
    }

    const result = parseDecklistText(decklistText);
    return c.json(result);
});

// GET /api/set-icon/:setCode — proxies SVG from Scryfall to avoid CORS
app.get("/api/set-icon/:setCode", async (c) => {
    const setCode = c.req.param("setCode");
    const {byCode} = await getSets();
    const svgUrl = byCode.get(setCode)?.icon_svg_uri;
    if (!svgUrl) {
        return c.json({error: "Icon not found"}, 404);
    }
    try {
        const upstream = await fetch(svgUrl);
        if (!upstream.ok) {
            return c.json({error: "Icon not found"}, 404);
        }
        const svgText = await upstream.text();
        return c.body(svgText, 200, {
            "Content-Type": "image/svg+xml",
            "Cache-Control": "public, max-age=86400",
        });
    } catch {
        return c.json({error: "Failed to fetch icon"}, 502);
    }
});

// Cache-Control: no-cache on all non-icon responses
app.use("/*", async (c, next) => {
    await next();
    if (!c.req.path.startsWith("/api/set-icon/")) {
        c.header("Cache-Control", "no-cache");
    }
});

// Serve the web/ directory: pages, js modules and any other assets.
// The root path "/" resolves to web/index.html via serveStatic's index handling.
app.get("/*", serveStatic({root: webDir, index: "index.html"}));

// Error handling
app.notFound((c) => c.json({error: "Not Found"}, 404));
app.onError((err, c) => {
    console.error("Server error:", err);
    return c.json({error: err.message}, 500);
});

const server = serve({
    fetch: app.fetch,
    port: PORT,
});

console.log(`🎴 MTG Arena Card Art Viewer Server`);
console.log(`📡 Server running at http://localhost:${PORT}`);
console.log(`\n📄 Pages:`);
console.log(`   GET  /                 - Card art viewer`);
console.log(`   GET  /multi-rarity.html - Multi-rarity cards`);
console.log(`   GET  /decklist.html    - Decklist parser`);
console.log(`   GET  /keywords.html    - Keywords not in Arena`);
console.log(`   GET  /frame.html       - Non-standard frame cards`);
console.log(`\n📋 API endpoints:`);
console.log(`   GET  /api/sets         - Returns all Arena sets with metadata`);
console.log(`   GET  /api/sets/:code   - Returns cards for a specific set`);
console.log(`   GET  /api/search/cards - Returns fuzzy card search results`);
console.log(`   GET  /api/cards/multi-rarity - Returns cards printed at both high and low rarity`);
console.log(`   GET  /api/cards/no-2015-frame - Returns non-standard frame printings (paginated)`);
console.log(`   GET  /api/cards/keywords-not-in-arena - Returns cards with keywords not in Arena`);
console.log(`   GET  /api/set-icon/:code - Proxies the Scryfall set icon SVG`);
console.log(`   POST /api/decklist/parse - Parses a pasted decklist into card rows`);
console.log(`\n✨ Open http://localhost:${PORT} in your browser`);
console.log(`\nPress Ctrl+C to stop the server\n`);

server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
        console.error(`❌ Port ${PORT} is already in use`);
        console.error(
            `   Try setting PORT environment variable: PORT=3001 node scripts/cli/serve-card-art-viewer.js`,
        );
    } else {
        console.error(`❌ Server error:`, err.message);
    }
    process.exit(1);
});
