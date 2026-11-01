/**
 * Smoke test for the web UI: boots the art viewer server, requests every page and
 * every local asset those pages reference, and fails on any non-200 response or
 * missing marker.
 *
 * Usage: node scripts/cli/smoke-web.js
 */
import {spawn} from "node:child_process";
import path from "node:path";
import {fileURLToPath} from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "../..");
const serverEntry = path.join(repoRoot, "scripts/cli/serve-card-art-viewer.js");

const PORT = Number(process.env.SMOKE_PORT) || 3999;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const STARTUP_TIMEOUT_MS = 30_000;

/** Pages that must exist, with a marker that must appear in the HTML. */
const PAGES = [
    {url: "/", marker: "Card Art Viewer"},
    {url: "/index.html", marker: "Multi-Rarity Cards"},
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

    const deadline = Date.now() + STARTUP_TIMEOUT_MS;
    while (Date.now() < deadline) {
        if (child.exitCode !== null) {
            throw new Error(`Server exited early (code ${child.exitCode}):\n${output.join("")}`);
        }
        try {
            const response = await fetch(`${BASE_URL}/`, {signal: AbortSignal.timeout(1000)});
            if (response.status === 200) {
                await response.arrayBuffer();
                return child;
            }
        } catch {
            // not ready yet
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }

    child.kill();
    throw new Error(`Server did not become ready within ${STARTUP_TIMEOUT_MS} ms:\n${output.join("")}`);
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

async function main() {
    const child = await startServer();
    pass(`server ready on ${BASE_URL}`);

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
    } finally {
        child.kill();
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
