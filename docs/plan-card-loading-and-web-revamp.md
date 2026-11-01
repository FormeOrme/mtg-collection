# Revamp Plan — Card Loading, Output Structure, and Web Front-End

| | |
|---|---|
| **Status** | Draft — only §8.2 (`sets` semantics) and §8.7 (sequencing) remain open |
| **Created** | 2026-11-01 |
| **Updated** | 2026-11-01 — Tailwind via CDN, `scryfall_arena_data.json` dropped, `scryfall_barebone.json` frozen as a public contract, `nav.js` adopted, `check.html` and `sad.html` deleted |
| **Scope** | `scripts/lib/loaders.js`, `scripts/lib/domain.js`, `scripts/lib/io.js`, `scripts/workflows/build-scryfall-arena-data.js`, `scripts/cli/serve-card-art-viewer.js`, `web/` |
| **Owner** | TBD |

---

## 1. Goals and non-goals

### Goals

1. **One card-loading path.** A single module parses the Scryfall bulk sources once per process and exposes one canonical card index, used by both the data build and the HTTP server.
2. **Predictable data.** Card identity joined on `oracle_id`, explicit policies for what counts as a set, a rarity, or a card — no silent field drops and no accidental cross-card merges.
3. **Bounded memory.** Build under ~300 MB RSS instead of the current 1.26 GB; server memory flat across requests instead of growing per endpoint.
4. **Declarative outputs.** Output files are declared as field specs, not written by bespoke mapping functions.
5. **Organised web app.** JS in `web/js/`, all custom CSS replaced by Tailwind (loaded from the CDN), no inline `style=` attributes, no duplicated helper code across pages.
6. **Every phase is verifiable.** A golden-output diff proves behaviour changes are intentional.

### Non-goals

- Changing the *content* of `arena_collection.json` (user collection processing stays as-is, only its loader dependency is shared).
- Adding a front-end framework or bundler. Pages stay plain HTML + ES modules.
- Rewriting the card-art gallery UX.

---

## 2. Current state (measured, not estimated)

### 2.1 Data pipeline

`npm run build:scryfall-arena` executes `scripts/workflows/build-scryfall-arena-data.js`:

```
oracle-cards.json  (47.5 MB, 39,287 cards)
        │  JSON.parse whole file → filter legalCards() → sort by released_at
        ▼
  32,835 oracle cards ──┐
                        ├── mapCardData(card) → { id, t, sets, r, ci, a }
default-cards.json      │
  (142.6 MB, 120,019)   │     renderFunction → JSON.stringify → join(",\n")
        │               ▼
   cardDataMap() → 32,835 DefaultCard instances
        │
        ▼
data/generated/scryfall_barebone.json   (3.94 MB, 32,835 rows)
```

> Snapshot names are undated now (`default-cards.json`, `oracle-cards.json`) and the download allowlist keeps only fields the app reads (`data/config/scryfall_filter.json` v2.0: 142.6 MB / 47.5 MB, down from 225 MB / 75 MB). The card counts, timings and byte figures above are the pre-refresh baseline; `scryfall_barebone.json` itself has not been regenerated since.

Measured baseline on this machine:

| Metric | Value |
|---|---|
| Wall time | **2.6 s** (`Loading oracle cards` 2.03 s + `scryfall_barebone.json` 0.14 s) |
| Peak RSS | **1,264 MB** (heap 918 MB after `cardDataMap()`) |
| Source bytes read | 300 MB |
| Output bytes written | 3.94 MB |
| Amplification | ~320× source RAM per output byte |

Row shape: `[nameKey, { id, t, sets, r, ci, a }]` with key presence `id` 32,835 · `t` 32,835 · `sets` 32,823 · `r` 32,775 · `ci` 30,075 · `a` 16,109.

Current module layout:

| File | Role | Problem |
|---|---|---|
| `scripts/lib/loaders.js` | reads + parses sources, builds `DefaultCard` / `OracleCard` | no caching, two parallel enrichment paths |
| `scripts/lib/domain.js` | legality, colour identity, complexity | complexity + 3 exports are dead |
| `scripts/lib/io.js` | file lookup + write | exact `<name>.<ext>` lookup, no fallback; non-atomic write |
| `scripts/lib/utils.js` | `slugify` / `normalize` | used as a join key (lossy) |
| `scripts/workflows/build-scryfall-arena-data.js` | maps + writes one output | dead `scryfall_arena_data` path removed (203 → 89 lines); rename + streaming still pending |
| `scripts/lib/cardUtils.js` | server-side queries over raw printings | re-parses `default-cards.json` (142.6 MB) per call, per-request scans |

### 2.2 Web front-end

| Page | Size | JavaScript | CSS |
|---|---|---|---|
| `art_view.html` | 21.4 KB | **inline**, ~470 lines | `/art_view.css` |
| `decklist.html` | 7.2 KB | **inline**, ~120 lines | `/art_view.css` |
| `frame.html` | 7.2 KB | **inline**, ~140 lines | `/art_view.css` |
| `keywords.html` | 2.3 KB | `common.js` + `keywords.js` | `/art_view.css` |
| `art_view.css` | 16.3 KB | — | **635 lines, 81 selectors**, Nunito `@font-face`, 2 media queries |

`check.html` (3.6 KB, Bootstrap CDN + external `util.js`) and `sad.html` have been **deleted** — see §2.3.

26 inline `style=` attributes across the 4 remaining pages. `createCardItem()` is implemented **three times** (`art_view.html`, `frame.html`, `common.js`) with slightly different behaviour (overlay text, lazy loading, `is_modern` highlight).

**Serving is currently broken.** Verified against a running server:

| URL | Result |
|---|---|
| `/` | 200 (`art_view.html`) |
| `/art_view.css`, `/common.js`, `/keywords.js` | **404** |
| `/static/art_view.css`, `/static/common.js` | **500** (`serveStatic` misconfigured) |
| `/decklist.html`, `/keywords.html`, `/frame.html`, `/check.html` | **404** |

Only `/api/*` and `/` are wired. The pages therefore only work when opened from disk — and even then their absolute asset paths (`/art_view.css`) fail.

*(Measured before `sad.html` and `check.html` were deleted; both are gone now.)*

`web/sad.html` was removed (stale consumer of the disabled `scryfall_arena_data.json` output).

### 2.3 `check.html` (removed)

It was a **"do I own this deck?" checker** — the only page that compared a decklist against the collection. Flow:

1. A `contenteditable` div (`#deckList`) was the input; there was no textarea and no parse button.
2. On every `input` event it fetched the *published* collection from the CDN (`.../mtg-collection@latest/arena_collection.json`).
3. It mapped the payload to a name→owned map, split the pasted text on newlines, and for each line starting with a digit:
   - split `"<qty> <name>"`,
   - computed `max = min(qty, 4)` (the Arena playset cap),
   - resolved the id with `SUtils.strip(name)` (from the external `util.js`),
   - looked up `owned = collection.get(id) || 0`.
4. It rewrote the div so each line became a Bootstrap badge with the quantity (red when `owned < max`) and the card name (red = not enough, green = enough).

It was broken in four independent ways:

| Problem | Detail |
|---|---|
| Wrong data shape | Line 24 destructured `{ n, o }`, but `arena_collection.json` is `[id, owned]` pairs → `new Map()` of `undefined → undefined` → `owned` was always `0` → **every card showed red** |
| External dependency | `SUtils`, `Div`, `Span` came from `cdn.jsdelivr.net/gh/FormeOrme/projects@latest/util.js`; if that moved, the page died |
| Renders inside an input handler | It cleared `deckList.innerText` and rebuilt DOM on every keystroke → caret was lost and the handler re-entered on its own mutation |
| Not reachable | Not linked from any page, not served by the Hono app, and depended on the Bootstrap CDN |

**Decision: deleted (§8.5).** The page is removed from `web/`; no replacement is built. Consequences: the Bootstrap CDN and the external `util.js` dependency disappear from the repo entirely, and the owned-vs-needed comparison is dropped as a feature. If it is ever wanted again, the cheap version is an "owned" column in `decklist.html` fed by `GET /api/collection`, not a separate page.

---

## 3. Findings the plan must fix

### 3.1 Correctness / data quality

| # | Finding | Evidence | Phase |
|---|---|---|---|
| C1 | `scryfallCard` dereferenced without null check (`build-scryfall-arena-data.js:43`) | Works only because all 32,835 names currently resolve; a new Arena-only card crashes the build | 1 |
| C2 | Rarity encoded as `card.rarity[0]` | `special` (63) and `bonus` (9) → `r` undefined → **60 rows missing `r`** | 1 |
| C3 | Ad-hoc set-type exclusion list (`loaders.js:21`) | **106 rows with `sets: []`**, 13 of them Arena-legal; `masterpiece`/`from_the_vault`/`spellbook`/`alchemy`/`funny`/`starter` still included | 4 |
| C4 | Card-type filter gap | **48 sticker cards** (`type_line: "Stickers"`, set `sunf`) in the artifact | 4 |
| C5 | Name-key join merges distinct cards | **71 oracle cards** get printings from a different card (`slugify()` collisions), corrupting `sets` and `lowestRarity` | 2 |
| C6 | `colorIdentity()` mutates its input | `.sort()` in place (`domain.js:57`); colour order is `WUBGR`, should be `WUBRG` (`domain.js:3`) | 1 |
| C7 | Sources are not pinned to one snapshot | `loadFile()` picks newest per prefix independently → oracle from date A + defaults from date B is possible and undetected | 1 |
| C8 | `loadFile()` "newest" is `readdirSync().reverse()` | Depends on filesystem iteration order | 1 — **fixed early:** exact-name lookup only, no `readdir` ordering |
| C9 | Output write is not atomic | `writeToData` truncates in place (`io.js:76`) | 1 |
| C10 | `legalCards` excludes Token/Attraction/Scheme/Conspiracy but not Stickers/Plane/Phenomenon/Vanguard | `domain.js:76-91` | 4 |

### 3.2 Loading and memory

| # | Finding | Evidence |
|---|---|---|
| L1 | No cache on `defaultData()` / `oracleData()` | **1.44 s and +700 MB RSS per call**; second call 1.54 s, RSS 722 → 1,038 MB |
| L2 | Server re-parses on every endpoint | `defaultData()` called in 6 places in `cardUtils.js`; `parseDecklistText` rebuilds a 106k-entry map **per POST** (`cardUtils.js:755`) |
| L3 | `DefaultCard` holds data nobody reads | `setMap`, `name`, `firstReleased`, `lastReleased`, `isReprint` — only `setList`, `rarity`, `games` are consumed. This is most of the 800 MB |
| L4 | Whole-array `JSON.parse` + full materialisation of the 3.9 MB output | Fine at 4 MB, blocking if an oracle-sized output returns |

### 3.3 Structure

| # | Finding |
|---|---|
| S1 | Two parallel enrichment implementations: `DefaultCard` + `cardDataMap` (build) vs `OracleCard` + `enrichedOracleData` (server). Same concepts, different shapes (`lowestRarity` is a method in one, a property in the other) |
| S2 | ~120 of 203 lines of the build workflow are dead: `standardValue`, `STANDARD_VALUE`, `hasAnyIn`, `oracleMapper`, `extractCardDetails`, `oracleArenaFaceMapper`, `oracleArenaMapper`, `FILTERS`, `SHRUNK`/`ORACLE`/`ORACLE_ARENA` specs |
| S3 | With `SHRUNK` gone, `mapCardData` only ever runs in `additionalData = true` mode — the flag and the bare `return baseData` path collapse |
| S4 | `slugify()` computed twice per card (in `mapCardData` and again in `cardDataMap`); key passed as `n` then destructured away by the render function |
| S5 | `await Promise.all()` over synchronous mappers; full array of strings joined in memory |
| S6 | Dead exports: `SLASHES`, `sets`, `modernLegal`, `calculateComplexity` (+ helpers) in `domain.js` |
| S7 | Naming/consistency: `exclude_set_type` is the only snake_case identifier; log line `Mapped to N unique cards` prints the oracle count, not a match count; timer label says "Loading oracle cards" but covers two sources |
| S8 | `art_view.html` and `frame.html` re-implement `common.js#createCardItem` |
| S9 | `frame.html` pagination uses inline `onclick="loadCards(n)"` (incompatible with ES modules) |

### 3.4 Web

| # | Finding |
|---|---|
| W1 | 404/500 for every static asset and secondary page (see §2.2) |
| W2 | 635 lines of global CSS with 81 selectors serving 4 pages; the whole file is loaded on every page |
| W3 | 26 inline `style=` attributes; 3 pages carry inline `<script>` blocks |
| W4 | No JS folder organisation; `keywords.js` relies on a global `createCardItem` from `common.js` |
| W5 | `check.html` used Bootstrap + an external `util.js` for `Div`/`Span` helpers and a dead data shape; deleted (§2.3) — the only two external UI dependencies in the repo go with it |
| W6 | `Nunito` `@font-face` points at a gstatic woff2 URL with `font-display: block`; disappears with `art_view.css` |

---

## 4. Target architecture

### 4.1 Card module layout

```
scripts/lib/cards/
  source.js      locate, validate, parse-or-stream bulk sources; memoized; exposes snapshot metadata
  policy.js      set-type policy, rarity ranking, type normalisation, card exclusions (config-driven)
  CardIndex.js   builds the single canonical index (by oracle_id + name-key aliases)
  printing.js    printing-level lookups: byOracleId, by (set, collector_number), by set
scripts/builders/
  barebone.js    declarative field spec → row  (the only published artifact)
scripts/workflows/build-card-data.js   (renamed from build-scryfall-arena-data.js)
data/config/card_policy.json           (set types, exclusions, Standard rotations)
```

`scryfall_arena_data.json` is retired (§8.3). Its dead helpers, `FILTERS.ARENA` and the README entry are already gone; the workflow file itself survives because it also emits `scryfall_barebone.json`, and it is renamed to `build-card-data.js` in Phase 3. The `calculateComplexity` chain in `domain.js` still goes with the rest of the S6 cleanup in Phase 3.

Bulk snapshots are `data/sources/default-cards.json` and `data/sources/oracle-cards.json` (undated, §8.10). They are **not** raw Scryfall output: `scripts/workflows/download-oracle-cards.js` filters each card through `data/config/scryfall_filter.json`, so any field the index later reads must be in that allowlist or it is silently absent (this is what hid `grid`, §8.9). The source module should validate that the fields it needs are present rather than assume a full Scryfall object.

`scripts/lib/loaders.js` keeps its five existing exports as thin, memoized wrappers over `CardIndex`, so `process-collection.js` and `cardUtils.js` continue to work unchanged during migration.

### 4.2 `CardIndex` contract

```js
/** @typedef {{
 *   oracleId: string,
 *   id: string,                 // representative printing id
 *   name: string,
 *   key: string,                // slugify(name) — lookup only, never a merge key
 *   type: "creature"|"instant"|...,
 *   colorIdentity: "WU"|undefined,
 *   arena: boolean,
 *   rarity: 0|1|2|3|undefined,  // lowest Arena rarity, explicit map
 *   sets: string[],             // policy-filtered, deduped, ordered
 *   firstReleased: string,
 *   lastReleased: string,
 * }} IndexedCard */

const index = getCardIndex();     // sync, memoized per process
index.byOracleId.get(oracleId)    // → IndexedCard
index.byKey.get("clearwater_pathway")          // alias table
index.printings.byOracleId.get(oracleId)       // → Printing[]
index.printings.bySetCollector.get("blb|123")  // → Printing[]
index.bySet.get("blb")                         // → Printing[]
index.stats                                    // unmatchedOracle, emptySets, unknownRarity, ...

const { oracle, printings, snapshot } = loadSources();
// snapshot = { oracleFile, defaultFile, takenAt, consistent: boolean }
```

**Join strategy.** Primary key is `oracle_id` (present in both sources). The name key becomes a *derived alias* used only for collection lookups, holding every alias that resolves to the same `oracle_id` (full name, front face only, `A-` Alchemy variant). This fixes C5 without breaking `process-collection.js`, which only has names.

### 4.3 Output builders

```js
// scripts/builders/barebone.js
export const barebone = {
    file: "scryfall_barebone.json",
    row: (c) => [c.key, {
        id: c.id,
        t: c.type,
        sets: c.sets,          // omitted when empty only if §8.2 says so
        r: c.rarity,
        ci: c.colorIdentity,
        a: c.arena || undefined,
    }],
};
```

The workflow becomes a loop over builder modules with a shared, streaming writer (`writeRows(file, iterable)` → tmp file → `rename`). Field order is fixed by the spec object, so output is byte-stable.

### 4.4 Web layout

```
web/
  index.html              ← renamed from art_view.html, asset refs relative
  decklist.html
  frame.html
  keywords.html
  js/
    tailwind-theme.js     ← classic script; injects the @theme block before the CDN loads
    nav.js                ← shared header/nav, self-initialises from <body data-nav="…">
    common.js             ← createCardItem, renderEmptyState/Loading/Error, debounce, fetchJson  (ES module)
    art-view.js
    decklist.js
    frame.js
    keywords.js
```
The `assets/favicon.ico` line is not needed today: the repo ships no favicon, so nothing was moved.

There is **no `css/` folder and no build output** — styling comes from the Tailwind CDN at runtime.

Rules:

- Every page loads, in this order: `js/tailwind-theme.js`, the Tailwind CDN script, then one entry module (`<script type="module" src="./js/<page>.js">`). No webfont request — `--font-sans` is a system UI stack (§4.5).
- No `<style>` blocks in HTML and no `style=` attributes; the one exception is the data-driven set-icon mask, which is set with `element.style.setProperty("--icon-url", …)` and consumed by a Tailwind arbitrary property (`[mask-image:var(--icon-url)]`).
- `art_view.html` → `index.html`, so `/` maps to the directory index.
- Shared helpers live only in `js/common.js` and are imported, not global. `frame.html`'s `onclick="loadCards(n)"` becomes event delegation on `data-page`.
- Every page imports and calls `nav.js` so the header/nav exists in exactly one place. Nav items are declared there as data, and the active page is derived from `<body data-nav="…">`.
- Every page declares `<link rel="icon" href="data:,">`; there is no favicon file, and this stops the browser from requesting a missing `/favicon.ico`.

### 4.5 Tailwind via CDN

No CLI, no `devDependency`, no committed CSS. Each page loads the v4 browser build and a shared theme module:

```html
<script src="./js/tailwind-theme.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.1"></script>
```

```js
// web/js/tailwind-theme.js  (classic script, must run before the CDN script)
const theme = document.createElement("style");
theme.type = "text/tailwindcss";
theme.textContent = `
  @theme {
    --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;

    /* Brand: indigo → violet */
    --color-accent:      #a5b4fc;
    --color-accent-mid:  #818cf8;
    --color-accent-dark: #6366f1;
    --color-accent-deep: #4f46e5;
    --color-accent-2:    #c084fc;

    /* Text */
    --color-body:   #e7e9f0;
    --color-muted:  #9aa2b5;
    --color-subtle: #6c7489;

    /* Canvas */
    --color-canvas:     #0a0b10;
    --color-canvas-end: #0e1017;
    --color-panel:      rgb(255 255 255 / 0.03);
    --color-line:       rgb(255 255 255 / 0.08);

    --shadow-card-hover: 0 18px 40px -18px rgb(0 0 0 / 0.9), 0 0 0 1px rgb(129 140 248 / 0.3);
    --shadow-focus:      0 0 0 3px rgb(99 102 241 / 0.25);
  }
`;
document.head.appendChild(theme);
```

The full token list (surfaces, borders, shadows, semantic text colours) lives in `web/js/tailwind-theme.js`; that file is the single place to retune the palette. The snippet above is the shape, not the whole file.

The script must be a **classic** (non-`defer`, non-module) script placed before the CDN script, so the theme element exists when the compiler initialises. `nav.js` and page scripts stay ES modules (deferred) — mixing the two is fine.

Consequences to accept (documented in `web/README.md`):

| Effect | Mitigation |
|---|---|
| Adds a runtime compiler script from jsDelivr to every page | Pin a minor version (`@4.1`); accept the ~1 request per page load, cached by the browser |
| Short flash of unstyled content while the compiler runs | Not added: the canvas colour sits on `<body>` via utilities (`bg-canvas`), so the flash is one frame of white — acceptable for a local app |
| The site now requires jsDelivr at load time | Already true for card images (Scryfall) and was already true for the removed `util.js` |
| No purge/optimisation — Tailwind generates only the classes present in the DOM, at runtime | Acceptable for a small personal app |
| Class names built dynamically in JS **do** work (the compiler observes DOM mutations) | Removes the static-literal constraint a build step would impose — JS-heavy markup is actually easier here |

The old `@font-face` block, the `display: block` flash (W6) and the Google Fonts request are all gone: Nunito was dropped in favour of the system UI stack, which removes one third-party request per page and the FOUT entirely.

### 4.6 Server routing (needed for both goals)

```js
app.get("/", (c) => c.html(fs.readFileSync(path.join(webDir, "index.html"), "utf8")));
app.use("/*", serveStatic({ root: webDir }));   // after /api/*, serves js/, assets/, pages
```

- All `serveStatic` usage goes through the same root and lets Hono set content types (fixes the 500s).
- `/api/*` routes are registered before the static middleware.
- Add `scripts/cli/smoke-web.js`: fetch every page and asset, assert 200 + a marker string, exit non-zero otherwise.

### 4.7 Backwards-compatibility contract for `scryfall_barebone.json`

The artifact has external consumers (§8.1), so from Phase 0 onward it is treated as a **public contract**:

```jsonc
[ "<slugify(name)>", { "id": "<uuid>", "t": "<type>", "sets": ["<code>"], "r": 0, "ci": "WU", "a": 1 } ]
```

| Rule | Detail |
|---|---|
| **Additive only** | New optional keys may be added. Existing keys are never renamed, retyped, or removed. |
| **`id` stays** | Even though it is ~37% of the payload. Removing/re-encoding it needs a major version and an announcement. |
| **Row order** | Ordering is part of the contract implicitly (release date then name). Keep it stable; document it. |
| **Array shape** | Stays an array of `[key, object]` pairs, not an object map. |
| **`a` semantics** | `1` or absent — never `0`. |
| **`ci`** | `WUBRG`-ordered string or absent. The `WUBGR` typo affects existing values; the Phase 1 fix is a **value** change, so it gets an allow-list entry in the parity diff and a release note. |
| **`sets`** | Policy changes here are value changes, not shape changes. They still require a release note. See §8.2. |

Anything that must break the contract ships as a **new file** (`scryfall_barebone_v2.json`) alongside the old one, with the old one generated from the same index for at least one release cycle. The parity tool gains a second mode (`--contract`) that fails on any non-additive change: missing keys, changed types, or a different row count.

### 4.8 Card image delivery — grid WebP

Every API payload's `image_uri` uses Scryfall's compact **`grid`** WebP variant instead of the `normal` JPG:

```js
// scripts/lib/cardUtils.js
function getFirstImageUri(card) {
    const faceUris = card.card_faces?.[0]?.image_uris;
    const uris = faceUris?.normal || faceUris?.grid ? faceUris : card.image_uris;
    if (!uris) return null;
    return uris.grid ?? toGridWebp(uris.normal);   // prefer a real grid URL, else rewrite
}
```

- Applied inside `getFirstImageUri()`, so **all** cards produced by `cardUtils.js` (set galleries, search, multi-rarity, frames, keywords, decklist) pick it up from one place.
- **Where `grid` comes from:** Scryfall's bulk JSONL (and the live API) does include `grid`/`thumb`/`display`/`crop`/`art`/`jpeg`. Our snapshot only had the JPG keys because `data/config/scryfall_filter.json` allowlists `image_uris` and never listed `grid`. The allowlist is fixed and trimmed (v2.0, 2026-11-01): each `image_uris` keeps only `normal` and `grid`, so `npm run download:oracle-cards` writes undated `default-cards.json` / `oracle-cards.json` snapshots with `grid`. `toGridWebp()` stays as a fallback for older snapshots: `getFirstImageUri()` prefers the real `grid` URL and only rewrites `normal` when it is absent.
- `grid` is 488×680 — the same size and aspect as `normal`, so no `object-fit` or `aspect-ratio` change was needed.
- ~50% smaller per image (30 KB vs 62 KB for the same card, measured).
- Only `{small,normal,large}/…jpg → grid/…webp` is valid: `grid/…jpg`, `normal/…webp` and `small/…webp` all 404. That is why the rewrite is a fixed two-step string transform rather than a generic `image_uris` key lookup.
- Nothing serialized changes: `scryfall_barebone.json` has no image URLs, so the artifact contract (§4.7) is untouched.

---

## 5. Phases

Estimates assume one developer familiar with the codebase.

Some items were pulled forward during the web port (2026-11-01) because the web work depended on them: undated snapshots, the trimmed download allowlist, exact-match `loadFile()`, the `strip` → `slugify` rename, and the dead `scryfall_arena_data` helpers. They are ticked in place below; nothing else in Phases 0–5 has started.

### Phase 0 — Guardrails (0.5 day)

- [ ] Snapshot the current artifact as `scripts/__fixtures__/scryfall_barebone.golden.json`
- [ ] `scripts/cli/verify-parity.js`: rebuild and report row count, per-key presence counts, and per-card diffs grouped by field
- [ ] Add `--contract` mode: fail on non-additive changes to `scryfall_barebone.json` (§4.7)
- [ ] `npm run verify:parity` wired (`npm run verify:web` already exists — Phase 6)
- [x] Record baseline metrics (wall time, RSS) in this document (§2.1)

**Done when:** parity tool reports `0 unexpected diffs` on an unmodified build.

### Phase 1 — Loading + correctness fixes, output unchanged (1–2 days)

- [ ] Memoize `defaultData()` / `oracleData()`; expose `resetCardCache()` for tests
- [x] `loadFile()`: resolve the exact `<name>.<ext>` in a `data/` subdirectory; drop the prefix/date fallback and the dead `Raw`/multi-directory search (C8 fixed early)
- [x] Undated snapshot names: `download-oracle-cards.js` writes `default-cards.json` / `oracle-cards.json` and logs the bulk `updated_at` instead (§8.10)
- [x] Trim `data/config/scryfall_filter.json` to the fields actually read, and add the two that were read but missing (`frame_effects`, `card_faces.illustration_id`); snapshots drop from 225 MB / 75 MB to 142.6 MB / 47.5 MB (§8.10)
- [ ] Validate the oracle/default snapshot pair; warn when snapshots are from different bulk exports (the filename-date check is moot now that names are undated — compare an embedded `takenAt`, §4.2)
- [ ] Null guard for missing `scryfallCard` (C1)
- [ ] Explicit rarity map incl. `special` / `bonus` (C2)
- [ ] Make `colorIdentity()` pure, fix `WUBRG` order (C6)
- [ ] Atomic output write: `writeFile(tmp)` + `rename` (C9)
- [ ] Remove unused `DefaultCard` fields: `setMap`, `name`, `firstReleased`, `lastReleased`, `isReprint` (L3)
- [ ] Fix log/timer labels and the "Mapped to N unique cards" message (S7)
- [x] Rename the internal `strip()` helper to `slugify()` so the verb matches the `slug` noun it produces (done early; output unchanged)

**Done when:** parity diff limited to the 60 previously-missing `r` values; RSS ≤ 400 MB; wall time ≤ 2.5 s.

### Phase 2 — Unify the index (2–3 days)

- [ ] Add `scripts/lib/cards/{source,policy,CardIndex,printing}.js`
- [ ] Join on `oracle_id`; build the alias key table for names (C5)
- [ ] Reimplement `loaders.js` exports as wrappers over `getCardIndex()`; delete `DefaultCard` and `OracleCard`
- [ ] Keep `OracleCard`-shaped fields (`inArena`, `sets`, `lowestRarity`) available on index cards so `cardUtils.js` needs no change yet
- [ ] Unit checks: 71 previously-contaminated cards now resolve to correct `sets`; alias lookups still hit

**Done when:** `cardUtils.js` and `process-collection.js` run unmodified and `verify:parity` shows only the expected C5/C2 rows changed.

### Phase 3 — Declarative outputs + streaming (1 day)

- [ ] Move the output spec into `scripts/builders/`
- [ ] `writeRows()` streaming writer with fixed field order
- [x] Delete the retired `scryfall_arena_data.json` path and its dead helpers: `standardValue`, `STANDARD_VALUE`, `hasAnyIn`, `oracleMapper`, `extractCardDetails`, `oracleArenaMapper`, `oracleArenaFaceMapper`, `FILTERS.ARENA`, plus the commented `SHRUNK`/`ORACLE`/`ORACLE_ARENA` specs (done early, §8.3; barebone output verified byte-identical)
- [ ] Collapse the `additionalData` flag (S3) and remove the dead exports in `domain.js` (S6)
- [ ] Rename workflow to `build-card-data.js`; update `package.json`
- [ ] Keep `id` (public contract, §4.7); no set-code encoding changes without a major version

**Done when:** artifact is byte-identical to Phase 2 output apart from the deliberate field changes.

### Phase 4 — Policy as config (1 day)

- [ ] `data/config/card_policy.json`: included/excluded set types (with a comment field explaining *why*), excluded card types, Standard rotation sets
- [ ] Replace `exclude_set_type`, `STANDARD_VALUE`, and the `legalCards` type regexes with policy lookups (C3, C4, C10)
- [ ] Emit `index.stats` warnings for cards left with no sets after filtering
- [ ] Move `STANDARD_VALUE` dates into config and add a "reviewed_at" field

**Done when:** `sets: []` rows are explainable by policy (target 0), stickers no longer appear, and rotating `card_policy.json` changes the artifact without code edits.

### Phase 5 — Server indices (2 days)

- [ ] `printings.bySetCollector` for `parseDecklistText` (removes the per-POST 106k map)
- [ ] `bySet` for `getCardsBySet` / `buildArenaSets` (removes per-request full scans)
- [ ] Replace all six `defaultData()` calls in `cardUtils.js` with index accessors
- [ ] Fetch `/sets` once at startup into a cached `sets.json` (or persist from the bulk snapshot) so the server has no hard network dependency
- [ ] Reuse `createCardItem`-shaped payload builders between endpoints

**Done when:** first request for each endpoint under 200 ms after warm-up; RSS flat across 50 sequential requests.

### Phase 6 — Web reorganisation + routing (1 day) — **shipped**

- [x] Move JS to `web/js/`, favicon to `web/assets/`; **no `css/` folder** (Tailwind is CDN-only) — there was no favicon in the repo, so nothing to move
- [x] `art_view.html` → `index.html`; asset paths relative (`./js/…`)
- [x] Extract inline scripts: `art_view.html` → `js/art-view.js`, `decklist.html` → `js/decklist.js`, `frame.html` → `js/frame.js`
- [x] Convert `common.js` + page scripts to ES modules; delete the two duplicate `createCardItem` implementations (W4, S8)
- [x] Replace `frame.html` inline `onclick` with delegated `data-page` clicks (S9)
- [x] Add `js/nav.js`, imported by every page, replacing the four duplicated `<header>` blocks
- [x] Fix `serveStatic` (W1) and add `scripts/cli/smoke-web.js` (`npm run verify:web`)
- [x] Delete `art_view.css`

**Done when:** every page and asset returns 200 from the server; no inline `<script>` remains; one `createCardItem`.
→ Verified: `npm run verify:web` = 13/13 (5 pages + 7 modules + server ready). All six data APIs returned 200 in a manual pass.

### Phase 7 — Tailwind migration via CDN (1.5–2.5 days) — **shipped**

- [x] Add `web/js/tailwind-theme.js` with the `@theme` tokens from §4.5; wire it before the CDN script on every page
- [x] Pin the CDN version (`@tailwindcss/browser@4.1`); **drop the Google Fonts request** and use a system UI stack (`--font-sans`)
- [x] Convert each page's markup to utilities, starting with `index.html`
- [x] Remove all 26 inline `style=` attributes (except the data-driven mask custom property)
- [x] Convert JS-generated markup (`createCardItem`, nav, set badges, keyword sections, pagination, decklist rows) to Tailwind classes
- [x] Decide on the optional one-line background guard against the unstyled flash (§4.5) — **not added**; the gradient lives on `<body>` via utilities
- [x] Delete `web/art_view.css` and the `@font-face` block (W2, W6)
- [x] Modernise, don't just port: graphite canvas + indigo→violet accent palette, sticky translucent nav, page heroes, section rules, `rounded-xl/2xl` surfaces, dashed empty states (§8.8)
- [x] Switch every card image to the `grid` WebP variant (§4.8, §8.9)

**Done when:** `web/` contains no `.css` file, no `<style>` block and no `style=` attribute (except the documented mask exception), and the visual diff against the previous pages is approved.
→ Structure and browser behaviour verified; the **visual** sign-off is still yours — run `npm run serve:art-viewer` and open http://localhost:3000.

**How the web port was verified (2026-11-01)**

| Check | Result |
|---|---|
| `npm run verify:web` | 13/13 — 5 pages + 7 modules, correct content types |
| All six data endpoints | 200 (`/api/sets`, `/api/sets/:code`, `/api/search/cards`, `/api/cards/multi-rarity`, `/api/cards/no-2015-frame`, `/api/cards/keywords-not-in-arena`, `POST /api/decklist/parse`) |
| Image URLs | Every endpoint emits `https://cards.scryfall.io/grid/…webp`, never `normal/…jpg` |
| Utility names | Compiled `web/**/*.{html,js}` with the real Tailwind v4 engine: all 291 classes used by the pages generate CSS, no misses (including the radial-gradient arbitrary value) |
| Headless browser | Edge via CDP on `/`, `/keywords.html`, `/frame.html`, `/decklist.html`: nav active state, sets expand (202 badges), set gallery (55 cards), search (1 card, related highlight), multi-rarity (319 arts), keyword accordion (68 sections, expand/collapse all, index links), frame pagination (page 1 → 2 of 16), decklist parse (2 cards, qty badges) + clear (130 px → restored) — no console errors |
| Layout | Screenshots at 1280 px and 470 px: sticky nav, hero, set-icon masks, card hover lift, qty badges, modern-frame outline, panel/rule rhythm all render as designed |

### Phase 8 — Page consolidation (0.5–1 day) — **shipped**

- [x] Verify no Bootstrap, `util.js`, `SUtils`, or `Div`/`Span` references remain after the `check.html` deletion (§2.3)
- [x] Accessibility pass: focus states, `aria-expanded` on the sets toggle, `aria-current` on pagination, `alt` text on all card images
- [x] Lazy-load images consistently (`loading="lazy"` + `decoding="async"`)

### Phase 9 — Docs and release (0.5 day)

- [ ] Rewrite `README.md`: correct artifact descriptions, drop the stale "Standard status" claim, remove the `scryfall_arena_data.json` section, document the new npm scripts
- [ ] Add `web/README.md` with the folder rules, the CDN dependency, and the `data-nav` convention
- [ ] Publish the contract/release note for the `ci`, `r` and `sets` value changes (§4.7)
- [ ] Note the breaking changes: `art_view.html` → `index.html`, asset paths, removed artifacts
- [ ] Regenerate all artifacts from a single pinned bulk snapshot and commit

**Total estimate:** ~10–14 working days, Phases 0–5 (data) ≈ 7–9 days, Phases 6–9 (web) ≈ 3.5–5 days; the two tracks can run in parallel after Phase 2.

---

## 6. Verification strategy

| Layer | Mechanism |
|---|---|
| Data parity | `verify:parity` — golden fixture diff with per-field grouping and an explicit allow-list of intended changes |
| Snapshot freshness | Re-run `download:oracle-cards`; assert each snapshot carries every field the index reads (today: `image_uris` = `normal` + `grid`, plus `frame_effects` and `card_faces.illustration_id`) |
| Data invariants | Assertions in `CardIndex.build()`: no duplicate `oracle_id`, no card with both empty `sets` and `arena: true` unless policy says so, every `r` in `{0,1,2,3}`, no `t: "card"` |
| Loading | `node --expose-gc` probe asserting RSS < 400 MB and one parse per process |
| Server | `verify:web` smoke: all pages/assets 200 + marker; a warm-up + 50-request loop asserting flat RSS |
| Front-end | Manual visual checklist per page at 1280/768/480 px; optional Playwright screenshots if wanted |
| Regression guard | `npm run verify` = `verify:parity && verify:web` |

---

## 7. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| External consumers break on **value** changes (`ci` order, added `r`, `sets` policy) | Medium | Additive-only contract (§4.7), `--contract` parity mode, release notes; breaking shape changes ship as a parallel `_v2` file |
| Switching to `oracle_id` changes which printings count, altering `sets`/`r` for the 71 affected cards | Certain (intended) | Contained by Phase 2 parity diff and a targeted test list of those cards |
| Tailwind CDN slow or unreachable → page renders unstyled | Low–Medium | Pin the version; optional inline background guard; the app already needs network for Scryfall card images |
| Set-type policy change removes sets users rely on | Medium | Ship policy in config, document the rationale, keep the old list as the default |
| `fetchScryfallSets()` network dependency at startup | Medium | Cache `/sets` locally from the bulk snapshot (Phase 5) |
| Losing the visual design during the Tailwind port | Medium | Port page-by-page with screenshots; keep `@theme` tokens identical to the current `:root` |

---

## 8. Decisions

### 8.1 `scryfall_barebone.json` has external consumers — **resolved**

Treat the file as a public contract: additive-only changes, `id` stays, row shape and array-of-pairs format frozen, contract enforced by `verify:parity --contract` (§4.7). Removals or re-encodings require a new `_v2` file published alongside the current one.

### 8.2 What `sets` means — **open, pending your thinking**

This is the one substantive policy decision left, and it is only "complex" because it mixes five independent questions. Deciding them separately is easier:

| # | Question | Current behaviour | Axes |
|---|---|---|---|
| a | **Scope** — all printings, or "obtainable" only? | All except `treasure_chest`, `masters`, `box`, `promo` | Which of: `promo`, `masters`, `box`, `treasure_chest`, `masterpiece`, `from_the_vault`, `premium_deck`, `spellbook`, `duel_deck`, `starter`, `funny`, `memorabilia`, `alchemy`, `minigame` |
| b | **Arena-only sets** (`anb`, `j25`, `ysnc`, `yeoe`…) | Included, indistinguishable from paper sets | Include / exclude / expose a separate `arenaSets` field |
| c | **Alchemy rebalances** (`A-` names, `alchemy` type) | Add their set codes to the base card | Exclude / merge / keep as separate card rows |
| d | **Variant and foreign printings** (`fbb`, `4bb`, `sum`, `plst`, `sld`, `prm`) | Included as distinct codes | Keep / fold into the parent set / drop |
| e | **Empty result** (106 cards today) | `sets: []` | Allow (documented) / fall back to the oracle `set` / drop the card |
| f | **Basic lands** | `sets` omitted entirely | Keep omitted / include like any other card |
| g | **Ordering** | Default-cards file order (stable but arbitrary) | Insertion order / release-date order / alphabetical |
| h | **Meaning of `a` vs `sets`** | Independent: `sets` is paper-wide, `a` is Arena availability | Keep independent / make `sets` Arena-only when `a: 1` |

A defensible default, if you want one to react to: *non-excluded printings, ordered by release date, Arena-only sets included and distinguished by the card-level `a` flag, basics keep `sets` omitted, and `[]` allowed but reported in `index.stats`.* Nothing is locked in until you decide.

### 8.3 `scryfall_arena_data.json` — **resolved: dropped**

No in-repo consumer (`sad.html` removed) and not needed. The retired output path, the `SHRUNK` spec, `FILTERS.ARENA`, `oracleArenaMapper`/`oracleArenaFaceMapper`, and the other helpers only it used are deleted, and the README section is removed.

Note: the file that produced it (`scripts/workflows/build-scryfall-arena-data.js`) **cannot be deleted** — it is the only generator of `scryfall_barebone.json`. It stays until Phase 3 renames it to `build-card-data.js` and moves the output spec into `scripts/builders/`. Deleting the retired output kept the generated barebone byte-identical (verified by SHA-256).

The `calculateComplexity` chain in `domain.js` is still to be deleted with the rest of the S6 dead exports (Phase 3).

### 8.4 Navigation — **resolved: `js/nav.js`**

One module, imported by every page, rendering the header/nav into a container and deriving the active item from `<body data-nav="…">`.

### 8.5 `check.html` — **resolved: deleted**

Removed from `web/`. No replacement page is built: `decklist.html` + `POST /api/decklist/parse` already covers parsing, and the page was broken, unreachable, and depended on Bootstrap plus an external `util.js`. If an owned-vs-needed view is ever wanted, add an "owned" column to `decklist.html` from `GET /api/collection` rather than reviving the page. Details in §2.3.

### 8.6 Tailwind delivery — **resolved: CDN**

Tailwind v4 browser build from jsDelivr, pinned to a minor, with the theme in a shared `js/tailwind-theme.js`. No local build, no committed CSS, no `@tailwindcss/cli` dependency (see §4.5 for the accepted trade-offs).

### 8.7 Sequencing of the value fixes — **open**

Fix C5 (`oracle_id` join) in Phase 2 and C3/C4 (set policy, stickers) in Phase 4, all behind the parity allow-list, or hold byte-parity until the `sets` decision in §8.2 lands? Recommendation: fix C5 in Phase 2 (independent of `sets`), and defer C3/C4 until §8.2 is decided.

### 8.8 Visual language — **resolved: modernise, not port**

The port was an opportunity to replace the 2018-era look, so the pages are redesigned rather than translated:

| Aspect | Before | Now |
|---|---|---|
| Font | Nunito webfont (Google Fonts) | System UI stack, no webfont request |
| Palette | Blue accents (`#64b5f6`…) on grey `#1e1e1e` | Indigo→violet accents (`#a5b4fc` → `#c084fc`) on graphite `#0a0b10` |
| Header | Static bar with a per-page title + action button | Sticky translucent bar, brand mark, four nav links, active page from `data-nav` |
| Page top | One gradient title line | Hero block: `h1` + one-line subtitle, multi-rarity button as a page action |
| Sections | Ad-hoc headings | Uppercase micro-label + hairline rule, consistent spacing (`mt-10`/`mb-3`) |
| Surfaces | 4 px radii, solid borders | `rounded-xl/2xl`, white-alpha borders, soft indigo shadows, hover lift |
| Empty states | Emoji icon + grey text | Dashed panel with title + hint, no emoji anywhere in the UI |

All tokens live in `web/js/tailwind-theme.js`; `--color-surface*` was renamed `--color-canvas*` because the palette is no longer a single surface colour. Retuning the whole site means editing that one file.

### 8.9 Card image variant — **resolved: grid WebP**

`normal` JPG → `grid` WebP, applied once in `cardUtils.js` (§4.8). Scryfall's bulk JSONL and API both expose a real `grid` URL; the local snapshot was missing it because `data/config/scryfall_filter.json` allowlisted six JPG image keys. The allowlist now keeps only `normal` + `grid` (v2.0) and snapshots are undated, so fresh downloads use `grid` directly and `toGridWebp()` remains as a fallback for older ones. Verified: same 488×680 aspect, ~50% smaller, no artifact/serialization impact. Rejected: `small` (too soft on 2× displays), `large`/`png` (3–10× the bytes for a thumbnail grid).

### 8.10 Snapshot naming + download allowlist — **resolved**

**One undated file per bulk type.** `download-oracle-cards.js` writes `data/sources/default-cards.json` and `data/sources/oracle-cards.json`; the Scryfall `updated_at` timestamp is logged, not encoded in the filename.

- **Why:** a dated filename forces every consumer to keep guessing which file is current (C7/C8) and makes "the snapshot" drift per machine. One canonical name per type removes that ambiguity; re-downloading replaces it.
- **Compatibility:** `loadFile()` resolves the exact `<name>.<ext>` only — no prefix or date fallback. Since `data/sources` is gitignored, there is nothing to migrate: a machine with only dated snapshots re-runs `npm run download:oracle-cards`, and a missing file fails with a message saying so.
- **Rejected:** keeping the date in the name (more churn, no benefit once files are replaced), or writing a `latest.json` pointer (a second file to keep in sync for nothing).

**The allowlist defines the snapshot's shape.** `data/config/scryfall_filter.json` (v2.0) keeps only fields the app reads, so the snapshot is deterministic rather than "whatever Scryfall shipped that week":

| Kept | Why |
|---|---|
| `id`, `oracle_id`, `name`, `type_line`, `keywords`, `legalities`, `games`, `color_identity` | index, filters, keyword page |
| `image_uris.normal`, `image_uris.grid` | JPG fallback + WebP grid (§8.9) |
| `card_faces.illustration_id`, `card_faces.image_uris.{normal,grid}` | DFC art + `getIllustrationId` |
| `scryfall_uri`, `rarity`, `set`, `set_type`, `collector_number`, `border_color`, `frame`, `frame_effects`, `illustration_id`, `released_at` | printings, frame/set policy, links, sorting |

- **Rule:** if code starts reading a field, add it to the allowlist **and re-download**; the snapshot will not contain it otherwise. `frame_effects` and `card_faces.illustration_id` were missing under the old list and are now included.
- **Result:** `default-cards.json` 228.7 → **142.6 MB**, `oracle-cards.json` 77.0 → **47.5 MB** (−38% each).
- **Caveat:** `scryfall_barebone.json` has not been regenerated since the snapshot refresh, so its row counts still reflect the older export.

---

## 9. Appendix — artifact field reference

Current row (`scryfall_barebone.json`):

| Key | Meaning | Source | Size share |
|---|---|---|---|
| *(array key)* | `slugify(name)` | oracle `name` | ~17% |
| `id` | Scryfall printing UUID | oracle `id` | **~37%** |
| `t` | main card type on the front face | `type_line` | small |
| `sets` | printing set codes | default printings, policy-filtered | ~17% |
| `r` | rarity index `c=0,u=1,r=2,m=3` | lowest Arena rarity | small |
| `ci` | colour identity `WUBRG` | oracle `color_identity` | small |
| `a` | present (`1`) when Arena-legal | default printings `games` | small |

Contract notes:

- `id` stays despite being 37% of the payload (§4.7).
- `scryfall_arena_data.json` is retired (§8.3). It additionally carried `com` (complexity), the only consumer of `calculateComplexity()` in `domain.js`; both are deleted in Phase 3.
- `ci` currently emits `WUBGR` order (typo in `domain.js:3`). Phase 1 changes it to `WUBRG`, which is a value change for every multicoloured card — flagged in the release note.
