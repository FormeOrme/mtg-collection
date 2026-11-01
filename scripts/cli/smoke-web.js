/**
 * Smoke test for the web UI: boots the art viewer server, requests every page,
 * every local asset those pages reference and every API endpoint the pages call,
 * and fails on any non-200 response, missing marker or unexpected payload.
 *
 * Usage: node scripts/cli/smoke-web.js
 *        SMOKE_BASE_URL=http://localhost:3000 node scripts/cli/smoke-web.js
 *
 * With SMOKE_BASE_URL the test targets an already-running server instead of
 * spawning its own, so it can catch stale or misconfigured dev servers.
 */
import {spawn} from "node:child_process";
import path from "node:path";
import {fileURLToPath} from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "../..");
const serverEntry = path.join(repoRoot, "scripts/cli/serve-card-art-viewer.js");

const PORT = Number(process.env.SMOKE_PORT) || 3999;
const EXTERNAL_BASE_URL = (process.env.SMOKE_BASE_URL || "").trim().replace(/\/+$/, "");
const BASE_URL = EXTERNAL_BASE_URL || `http://127.0.0.1:${PORT}`;
const STARTUP_TIMEOUT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 120_000;

/** Pages that must exist, with a marker that must appear in the HTML. */
const PAGES = [
    {url: "/", marker: "Card Art Viewer"},
    {url: "/index.html", marker: "Card gallery"},
    {url: "/multi-rarity.html", marker: "Multi-Rarity Cards"},
    {url: "/decklist.html", marker: "Decklist Parser"},
    {url: "/keywords.html", marker: "Keywords Not in Arena"},
    {url: "/frame.html", marker: "Non-Standard Frames"},
];

/** Static assets that must exist regardless of what the pages reference. */
const ASSETS = [
    "/js/tailwind-theme.js",
    "/js/common.js",
    "/js/nav.js",
    "/js/art-view.js",
    "/js/decklist.js",
    "/js/frame.js",
    "/js/keywords.js",
    "/js/multi-rarity.js",
];

/** API endpoints the pages call, with a payload validator returning an error message or null. */
const API_CHECKS = [
    {
        url: "/api/search/cards?q=path",
        validate: (data) => (
            typeof data?.status === "string" && Array.isArray(data.cards)
                ? null
                : "expected {status, cards[]}"
        ),
    },
    {
        url: "/api/cards/multi-rarity",
        validate: (data) => (
            Array.isArray(data?.cards) && data.total_cards === data.cards.length
                ? null
                : "expected {cards[], total_cards} with total_cards === cards.length"
        ),
    },
    {
        url: "/api/cards/no-2015-frame",
        validate: (data) => (
            Array.isArray(data?.cards) && Number.isInteger(data.total_pages)
                ? null
                : "expected {cards[], total_pages}"
        ),
    },
    {
        url: "/api/cards/keywords-not-in-arena",
        validate: (data) => (
            Array.isArray(data?.keywords) ? null : "expected {keywords[]}"
        ),
    },
];

const failures = [];
const passes = [];

/**
 * @param {string} message
 */
function fail(message) {
    failures.push(message);
    console.error(`✗ ${message}`);
}

/**
 * @param {string} message
 */
function pass(message) {
    passes.push(message);
    console.log(`✓ ${message}`);
}

/**
 * Waits until the server answers on BASE_URL.
 * @param {import("node:child_process").ChildProcess|null} child
 * @param {string[]} [output]
 */
async function waitForServer(child, output = []) {
    const deadline = Date.now() + STARTUP_TIMEOUT_MS;
    while (Date.now() < deadline) {
        if (child && child.exitCode !== null) {
            throw new Error(`Server exited early (code ${child.exitCode}):\n${output.join("")}`);
        }
        try {
            const response = await fetch(`${BASE_URL}/`, {signal: AbortSignal.timeout(1000)});
            if (response.status === 200) {
                await response.arrayBuffer();
                return;
            }
        } catch {
            // not ready yet
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }

    child?.kill();
    throw new Error(
        `Server did not become ready within ${STARTUP_TIMEOUT_MS} ms${output.length ? `:\n${output.join("")}` : ""}`,
    );
}

/**
 * Starts the server and resolves once it answers.
 * @returns {Promise<import("node:child_process").ChildProcess>}
 */
async function startServer() {
    const child = spawn(process.execPath, [serverEntry], {
        cwd: repoRoot,
        env: {...process.env, PORT: String(PORT)},
        stdio: ["ignore", "pipe", "pipe"],
    });

    const output = [];
    child.stdout.on("data", (chunk) => output.push(String(chunk)));
    child.stderr.on("data", (chunk) => output.push(String(chunk)));

    await waitForServer(child, output);
    return child;
}

/**
 * Requests a path and returns the response plus body text.
 * @param {string} urlPath
 * @returns {Promise<{status: number, contentType: string, body: string}>}
 */
async function get(urlPath) {
    const response = await fetch(`${BASE_URL}${urlPath}`, {signal: AbortSignal.timeout(20_000)});
    const body = await response.text();
    return {
        status: response.status,
        contentType: response.headers.get("content-type") ?? "",
        body,
    };
}

/**
 * Checks a page response and returns the local assets it references.
 * @param {{url: string, marker: string}} page
 * @returns {Promise<string[]>}
 */
async function checkPage(page) {
    const {status, contentType, body} = await get(page.url);
    if (status !== 200) {
        fail(`${page.url} → ${status} (expected 200)`);
        return [];
    }
    if (!contentType.includes("text/html")) {
        fail(`${page.url} → content-type "${contentType}" (expected text/html)`);
        return [];
    }
    if (!body.includes(page.marker)) {
        fail(`${page.url} → body does not contain marker "${page.marker}"`);
        return [];
    }
    pass(`${page.url} → 200 (html)`);

    const refs = new Set();
    for (const match of body.matchAll(/(?:src|href)="(\.\/[^"]+\.(?:js|css|html))"/g)) {
        refs.add(match[1].replace(/^\.\//, "/"));
    }
    return [...refs];
}

/**
 * Checks a static asset response.
 * @param {string} urlPath
 */
async function checkAsset(urlPath) {
    const {status, contentType, body} = await get(urlPath);
    if (status !== 200) {
        fail(`${urlPath} → ${status} (expected 200)`);
        return;
    }
    if (body.trim().length === 0) {
        fail(`${urlPath} → empty response`);
        return;
    }
    if (urlPath.endsWith(".js") && !/javascript|ecmascript/i.test(contentType)) {
        fail(`${urlPath} → content-type "${contentType}" (expected javascript)`);
        return;
    }
    pass(`${urlPath} → 200 (${contentType.split(";")[0]})`);
}

/**
 * Checks a JSON API response and validates its payload shape.
 * @param {string} urlPath
 * @param {(data: any) => string|null} validate - Returns an error description, or null when valid.
 * @param {RequestInit} [init]
 * @returns {Promise<any|null>} Parsed payload, or null when the check failed.
 */
async function checkJson(urlPath, validate, init) {
    const response = await fetch(`${BASE_URL}${urlPath}`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        ...init,
    });
    const contentType = response.headers.get("content-type") ?? "";
    const body = await response.text();

    if (response.status !== 200) {
        const detail = body.trim().slice(0, 300);
        fail(`${urlPath} → ${response.status} (expected 200)${detail ? `: ${detail}` : ""}`);
        return null;
    }
    if (!contentType.includes("application/json")) {
        fail(`${urlPath} → content-type "${contentType}" (expected application/json)`);
        return null;
    }

    let data;
    try {
        data = JSON.parse(body);
    } catch {
        fail(`${urlPath} → invalid JSON`);
        return null;
    }

    const problem = validate(data);
    if (problem) {
        fail(`${urlPath} → unexpected payload: ${problem}`);
        return null;
    }

    pass(`${urlPath} → 200 (json)`);
    return data;
}

/**
 * Checks a non-JSON response's status, content type and non-empty body.
 * @param {string} urlPath
 * @param {string} expectedContentType
 */
async function checkResponse(urlPath, expectedContentType) {
    const {status, contentType, body} = await get(urlPath);
    if (status !== 200) {
        fail(`${urlPath} → ${status} (expected 200)`);
        return;
    }
    if (!contentType.includes(expectedContentType)) {
        fail(`${urlPath} → content-type "${contentType}" (expected ${expectedContentType})`);
        return;
    }
    if (body.trim().length === 0) {
        fail(`${urlPath} → empty response`);
        return;
    }
    pass(`${urlPath} → 200 (${contentType.split(";")[0]})`);
}

async function main() {
    const external = Boolean(EXTERNAL_BASE_URL);
    const child = external ? null : await startServer();
    if (external) {
        await waitForServer(null);
    }
    pass(`server ready on ${BASE_URL}${external ? " (external)" : ""}`);

    try {
        const referenced = new Set(ASSETS);
        for (const page of PAGES) {
            for (const ref of await checkPage(page)) {
                referenced.add(ref);
            }
        }
        for (const asset of [...referenced].sort()) {
            await checkAsset(asset);
        }

        const sets = await checkJson("/api/sets", (data) => (
            Array.isArray(data) && data.length > 0 && data.every((set) => typeof set.code === "string")
                ? null
                : "expected a non-empty array of sets with codes"
        ));

        for (const check of API_CHECKS) {
            await checkJson(check.url, check.validate);
        }

        await checkJson("/api/decklist/parse", (data) => (
            Array.isArray(data?.cards) ? null : "expected {cards[]}"
        ), {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({decklist: "1 Island"}),
        });

        const sampleSet = Array.isArray(sets)
            ? sets.find((set) => set.icon_svg_uri && set.card_count !== 0)
            : null;
        if (sampleSet) {
            await checkJson(
                `/api/sets/${encodeURIComponent(sampleSet.code)}`,
                (data) => (Array.isArray(data) ? null : "expected an array of cards"),
            );
            await checkResponse(`/api/set-icon/${encodeURIComponent(sampleSet.code)}`, "image/svg+xml");
        } else {
            fail("/api/sets → no cacheable set available to test /api/sets/:code and /api/set-icon/:code");
        }
    } finally {
        child?.kill();
    }

    const total = passes.length + failures.length;
    console.log("");
    if (failures.length > 0) {
        console.error(`✗ ${failures.length} of ${total} checks failed`);
        process.exitCode = 1;
        return;
    }
    console.log(`✓ all ${total} checks passed`);
}

main().catch((error) => {
    console.error(`✗ smoke test crashed: ${error.message}`);
    process.exitCode = 1;
});
