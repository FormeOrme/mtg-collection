import {
    createCardItem,
    fetchJson,
    INFO_CLASS,
    INFO_WARNING_CLASS,
    renderEmptyState,
    renderError,
    renderLoading,
} from "./common.js";
import { renderNav } from "./nav.js";

const decklistInput = document.getElementById("decklistInput");
const parseBtn = document.getElementById("parseBtn");
const clearBtn = document.getElementById("clearBtn");
const parseInfo = document.getElementById("parseInfo");
const decklistResults = document.getElementById("decklistResults");

const EXPANDED_INPUT_CLASSES = ["h-[44vh]", "min-h-[320px]"];
const COLLAPSED_INPUT_CLASSES = ["h-[18vh]", "min-h-[130px]"];

renderNav();

/**
 * Renders an info or warning banner above the results.
 * @param {string} text
 * @param {string} className
 */
function setInfo(text, className = INFO_CLASS) {
    parseInfo.innerHTML = "";
    if (!text) {
        return;
    }
    const el = document.createElement("div");
    el.className = className;
    el.textContent = text;
    parseInfo.appendChild(el);
}

/**
 * Renders parsed decklist cards.
 * @param {{ cards?: Array<object> }} payload
 */
function renderResults(payload) {
    const cards = Array.isArray(payload.cards) ? payload.cards : [];
    const matchedCards = cards.filter((card) => card && card.matched);

    if (matchedCards.length === 0) {
        renderEmptyState(decklistResults, {
            title: "No cards parsed",
            hint: "Check your decklist format and try again.",
        });
        return;
    }

    decklistResults.innerHTML = "";
    for (const card of matchedCards) {
        const qty = card.quantity || 1;
        const item = createCardItem(
            {
                name: card.name || card.input_name || "Card",
                image_uri: card.image_uri,
                scryfall_uri: card.scryfall_uri,
                rarity: card.rarity,
            },
            { badge: qty },
        );

        if (!card.image_uri) {
            const placeholder = document.createElement("div");
            placeholder.className =
                "flex h-full w-full items-center justify-center bg-stone-50/[0.03] p-3 text-center text-xs text-subtle";
            placeholder.textContent = "No image";
            item.prepend(placeholder);
        }

        decklistResults.appendChild(item);
    }
}

/**
 * Sends the decklist to the parser.
 */
async function parseDecklist() {
    const decklist = decklistInput.value;
    if (!decklist.trim()) {
        setInfo("Paste a decklist before parsing.", INFO_WARNING_CLASS);
        return;
    }

    parseBtn.disabled = true;
    parseBtn.textContent = "Parsing...";
    renderLoading(parseInfo, "Sending decklist to parser...");

    try {
        const payload = await fetchJson("/api/decklist/parse", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ decklist }),
        });

        parseInfo.innerHTML = "";
        renderResults(payload);
        decklistInput.classList.remove(...EXPANDED_INPUT_CLASSES);
        decklistInput.classList.add(...COLLAPSED_INPUT_CLASSES);
    } catch (error) {
        console.error("Error parsing decklist:", error);
        renderError(parseInfo, `Error parsing decklist: ${error.message}`);
    } finally {
        parseBtn.disabled = false;
        parseBtn.textContent = "Parse decklist";
    }
}

/**
 * Clears the decklist and results.
 */
function clearDecklist() {
    decklistInput.value = "";
    decklistInput.classList.remove(...COLLAPSED_INPUT_CLASSES);
    decklistInput.classList.add(...EXPANDED_INPUT_CLASSES);
    parseInfo.innerHTML = "";
    renderEmptyState(decklistResults, {
        title: "No parsed cards yet",
        hint: "Paste your list and click Parse Decklist.",
    });
    decklistInput.focus();
}

parseBtn.addEventListener("click", parseDecklist);
clearBtn.addEventListener("click", clearDecklist);
