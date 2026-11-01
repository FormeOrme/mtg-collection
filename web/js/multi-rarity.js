import { createCardItem, fetchJson, renderEmptyState, renderError, renderLoading } from "./common.js";
import { renderNav } from "./nav.js";

const gallery = document.getElementById("gallery");
const galleryTitle = document.getElementById("galleryTitle");

renderNav();

/**
 * Loads and renders every Arena printing of cards that exist at both high and low rarity.
 */
async function loadCards() {
    renderLoading(gallery, "Fetching multi-rarity cards...");

    try {
        const payload = await fetchJson("/api/cards/multi-rarity");
        const cards = Array.isArray(payload.cards) ? payload.cards : [];

        if (cards.length === 0) {
            galleryTitle.textContent = "No printings";
            renderEmptyState(gallery, {
                title: "No multi-rarity cards found",
                hint: "No card has both a high-rarity and a low-rarity Arena printing.",
            });
            return;
        }

        const uniqueNames = new Set(cards.map((card) => card.name));
        galleryTitle.textContent =
            `${cards.length} printings · ${uniqueNames.size} card${uniqueNames.size !== 1 ? "s" : ""}`;

        gallery.innerHTML = "";
        for (const card of cards) {
            gallery.appendChild(createCardItem(card, { showSet: true }));
        }
    } catch (error) {
        console.error("Error loading multi-rarity cards:", error);
        galleryTitle.textContent = "Error";
        renderError(gallery, `Error loading cards: ${error.message}`);
    }
}

loadCards().catch((error) => console.error(error));
