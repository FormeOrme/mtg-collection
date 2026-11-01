import {
    createCardItem,
    debounce,
    enableRelatedHighlight,
    fetchJson,
    INFO_CLASS,
    INFO_SUCCESS_CLASS,
    INFO_WARNING_CLASS,
    renderEmptyState,
    renderError,
    renderLoading,
    SET_BADGE_ACTIVE_CLASS,
    SET_BADGE_CLASS,
    SET_ICON_MASK_CLASS,
} from "./common.js";
import { renderNav } from "./nav.js";

const SEARCH_DEBOUNCE_MS = 250;
const MIN_SEARCH_LETTERS = 3;

const gallery = document.getElementById("gallery");
const galleryInfo = document.getElementById("galleryInfo");
const setsContainer = document.getElementById("setsContainer");
const searchInput = document.getElementById("searchInput");
const clearBtn = document.getElementById("clearBtn");
const toggleSetsBtn = document.getElementById("toggleSetsBtn");

let selectedSet = null;
let setsMetadata = {};
let setsList = [];
let latestSearchToken = 0;
let setsLoaded = false;

/**
 * Counts alphabetic letters (A-Z) only.
 * @param {string} value
 * @returns {number}
 */
function countAlphabeticLetters(value) {
    const matches = String(value ?? "").match(/[a-z]/gi);
    return matches ? matches.length : 0;
}

/**
 * Renders a one-line info banner above the gallery.
 * @param {string} text
 * @param {string} [variant]
 */
function setInfo(text, variant = INFO_CLASS) {
    galleryInfo.innerHTML = "";
    const el = document.createElement("div");
    el.className = variant;
    el.textContent = text;
    galleryInfo.appendChild(el);
}

/**
 * Renders a card grid.
 * @param {Array<object>} cards
 */
function renderCards(cards) {
    gallery.innerHTML = "";
    for (const card of cards) {
        gallery.appendChild(createCardItem(card, { showSet: true }));
    }
}

/**
 * Renders set badges.
 * @param {Array<{code: string, name: string, card_count: number, icon_svg_uri?: string}>} sets
 */
function renderSetBadges(sets) {
    setsContainer.innerHTML = "";

    if (!sets || sets.length === 0) {
        renderError(setsContainer, "No sets data available");
        return;
    }

    for (const set of sets) {
        const badge = document.createElement("button");
        badge.type = "button";
        badge.className =
            selectedSet === set.code
                ? `${SET_BADGE_CLASS} ${SET_BADGE_ACTIVE_CLASS}`
                : SET_BADGE_CLASS;
        badge.title = set.name;
        badge.setAttribute("aria-label", `${set.name} (${set.code})`);
        if (selectedSet === set.code) {
            badge.setAttribute("aria-pressed", "true");
        }

        if (set.icon_svg_uri) {
            const iconWrap = document.createElement("div");
            iconWrap.className = "flex h-6 w-6 shrink-0 items-center justify-center";

            const mask = document.createElement("span");
            mask.className = SET_ICON_MASK_CLASS;
            mask.style.setProperty("--icon-url", `url('/api/set-icon/${set.code}')`);
            iconWrap.appendChild(mask);
            badge.appendChild(iconWrap);
        }

        const info = document.createElement("div");
        info.className = "flex min-w-0 flex-1 items-center";
        const code = document.createElement("div");
        code.className = "truncate text-xs font-semibold tracking-[0.06em] text-accent uppercase";
        code.textContent = set.code;
        info.appendChild(code);

        const count = document.createElement("div");
        count.className =
            "min-w-8 rounded-md border border-line-count bg-count-bg px-1.5 py-0.5 " +
            "text-center text-[11px] text-count tabular-nums";

        count.textContent = String(set.card_count);

        badge.append(info, count);
        badge.addEventListener("click", () => selectSet(set.code));
        setsContainer.appendChild(badge);
    }
}

/**
 * Loads the Arena sets from the API.
 * @returns {Promise<Array|null>}
 */
async function loadArenaSets() {
    try {
        return await fetchJson("/api/sets");
    } catch (error) {
        console.error("Error loading sets:", error);
        renderError(setsContainer, `Error loading data: ${error.message}`);
        return null;
    }
}

/**
 * Renders cards for a selected set.
 * @param {string} setCode
 */
async function renderGalleryForSet(setCode) {
    galleryInfo.innerHTML = "";
    renderLoading(gallery, "Loading cards...");

    try {
        const cards = await fetchJson(`/api/sets/${setCode}`);
        const setInfoData = setsMetadata[setCode];

        if (setInfoData) {
            setInfo(`${setInfoData.name} (${setInfoData.code}) - ${cards.length} card${cards.length !== 1 ? "s" : ""}`);
        }

        if (cards.length === 0) {
            renderEmptyState(gallery, {
                title: "No cards found",
                hint: "Try a different set.",
            });
            return;
        }

        renderCards(cards);
    } catch (error) {
        console.error("Error loading cards:", error);
        renderError(gallery, `Error loading cards: ${error.message}`);
    }
}

/**
 * Renders server-backed global search results.
 * @param {string} query
 */
async function renderSearchResults(query) {
    const token = ++latestSearchToken;
    galleryInfo.innerHTML = "";
    renderLoading(gallery, "Searching cards...");

    try {
        const payload = await fetchJson(`/api/search/cards?q=${encodeURIComponent(query)}`);
        if (token !== latestSearchToken) {
            return;
        }

        const letters = countAlphabeticLetters(query);

        if (payload.status === "inactive") {
            setInfo(`Type at least ${MIN_SEARCH_LETTERS} letters to activate search (${letters}/${MIN_SEARCH_LETTERS})`);
            renderEmptyState(gallery, {
                title: "Search inactive",
                hint: "Keep typing to run fuzzy search.",
            });
            return;
        }

        if (payload.status === "too_many") {
            setInfo(`${payload.total_matches} cards matched. Refine your search.`, INFO_WARNING_CLASS);
            renderEmptyState(gallery, {
                title: "Too many matches",
                hint: "Please type a more specific search term.",
            });
            return;
        }

        if (payload.status === "no_results") {
            setInfo(`No results for "${query}".`);
            renderEmptyState(gallery, {
                title: "No cards found",
                hint: "Try adjusting spelling or using another term.",
            });
            return;
        }

        setInfo(
            `Global search: ${payload.total_cards} card${payload.total_cards !== 1 ? "s" : ""}, ` +
            `${payload.total_arts} art${payload.total_arts !== 1 ? "s" : ""} for "${query}"`,
            INFO_SUCCESS_CLASS,
        );
        renderCards(Array.isArray(payload.cards) ? payload.cards : []);
    } catch (error) {
        if (token !== latestSearchToken) {
            return;
        }
        console.error("Error searching cards:", error);
        renderError(gallery, `Error searching cards: ${error.message}`);
    }
}

/**
 * Updates the clear button visibility.
 */
function updateControls() {
    const hasSearch = searchInput.value.trim().length > 0;
    clearBtn.classList.toggle("hidden", !(selectedSet || hasSearch));
}

/**
 * Selects a set, clearing the search filter.
 * @param {string} setCode
 */
function selectSet(setCode) {
    searchInput.value = "";
    latestSearchToken += 1;
    selectedSet = setCode;
    renderSetBadges(setsList);
    renderGalleryForSet(setCode);
    updateControls();
}

/**
 * Clears all filters and returns to the neutral state.
 */
function clearSelection() {
    selectedSet = null;
    latestSearchToken += 1;
    searchInput.value = "";
    renderSetBadges(setsList);
    galleryInfo.innerHTML = "";
    renderEmptyState(gallery, {
        title: "Select a set to view cards",
        hint: "Click on a set badge or use search above.",
    });
    updateControls();
}

/**
 * Handles search input updates.
 */
function onSearchInput() {
    const query = searchInput.value;
    const trimmedQuery = query.trim();
    const letterCount = countAlphabeticLetters(query);

    if (trimmedQuery.length > 0 && selectedSet) {
        selectedSet = null;
        renderSetBadges(setsList);
    }

    if (trimmedQuery.length > 0) {
        setSetsExpanded(false);
    }

    updateControls();

    if (trimmedQuery.length === 0) {
        latestSearchToken += 1;
        galleryInfo.innerHTML = "";
        renderEmptyState(gallery, {
            title: "Select a set to view cards",
            hint: "Click on a set badge or use search above.",
        });
        return;
    }

    if (letterCount < MIN_SEARCH_LETTERS) {
        latestSearchToken += 1;
        setInfo(`Type at least ${MIN_SEARCH_LETTERS} letters to activate search (${letterCount}/${MIN_SEARCH_LETTERS})`);
        renderEmptyState(gallery, {
            title: "Search inactive",
            hint: "Keep typing to run fuzzy search.",
        });
        return;
    }

    renderSearchResults(trimmedQuery);
}

/**
 * Fetches and renders sets, called lazily on first expand.
 */
async function loadAndRenderSets() {
    renderLoading(setsContainer, "Loading sets...");
    const sets = await loadArenaSets();
    if (!sets) {
        return;
    }
    setsList = sets;
    for (const set of sets) {
        setsMetadata[set.code] = set;
    }
    setsLoaded = true;
    renderSetBadges(sets);
}

/**
 * Shows or hides the sets grid and keeps the toggle in sync.
 * @param {boolean} expanded
 */
function setSetsExpanded(expanded) {
    setsContainer.classList.toggle("hidden", !expanded);
    toggleSetsBtn.textContent = expanded ? "Hide list" : "Show all";
    toggleSetsBtn.setAttribute("aria-expanded", String(expanded));
}

/**
 * Toggles the sets section.
 */
async function toggleSetsSection() {
    const collapsed = setsContainer.classList.contains("hidden");
    setSetsExpanded(collapsed);

    if (collapsed && !setsLoaded) {
        await loadAndRenderSets();
    }
}

renderNav();

clearBtn.addEventListener("click", clearSelection);
toggleSetsBtn.addEventListener("click", toggleSetsSection);
searchInput.addEventListener("input", debounce(onSearchInput, SEARCH_DEBOUNCE_MS));
enableRelatedHighlight(gallery);
updateControls();
