import { createCardItem, fetchJson, renderEmptyState, renderError, renderLoading } from "./common.js";
import { renderNav } from "./nav.js";

const gallery = document.getElementById("gallery");
const galleryTitle = document.getElementById("galleryTitle");
const topPagination = document.getElementById("topPagination");
const bottomPagination = document.getElementById("bottomPagination");

const PAGE_BUTTON_CLASS =
    "inline-flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg border border-line bg-white/[0.03] px-2.5 " +
    "text-[13px] font-medium text-muted transition hover:border-line-strong hover:bg-white/[0.07] hover:text-white " +
    "disabled:cursor-default disabled:border-transparent disabled:bg-accent-dark disabled:text-white";

renderNav();

/**
 * Builds the page items to render, inserting ellipses for long ranges.
 * @param {number} current
 * @param {number} total
 * @returns {Array<number|"...">}
 */
function buildPageItems(current, total) {
    if (total <= 9) {
        return Array.from({ length: total }, (_, index) => index + 1);
    }

    const pages = [1];
    const start = Math.max(2, current - 3);
    const end = Math.min(total - 1, current + 3);

    if (start > 2) {
        pages.push("...");
    }
    for (let page = start; page <= end; page += 1) {
        pages.push(page);
    }
    if (end < total - 1) {
        pages.push("...");
    }

    pages.push(total);
    return pages;
}

/**
 * Renders pagination controls into both containers.
 * @param {number} currentPage
 * @param {number} totalPages
 */
function updatePaginationControls(currentPage, totalPages) {
    const build = () => {
        const fragment = document.createDocumentFragment();

        for (const item of buildPageItems(currentPage, totalPages)) {
            if (item === "...") {
                const ellipsis = document.createElement("span");
                ellipsis.className = "text-muted";
                ellipsis.textContent = "...";
                ellipsis.setAttribute("aria-hidden", "true");
                fragment.appendChild(ellipsis);
                continue;
            }

            const button = document.createElement("button");
            button.type = "button";
            button.className = PAGE_BUTTON_CLASS;
            button.textContent = String(item);
            button.dataset.page = String(item);

            if (item === currentPage) {
                button.disabled = true;
                button.setAttribute("aria-current", "page");
            }

            fragment.appendChild(button);
        }

        return fragment;
    };

    topPagination.replaceChildren();
    bottomPagination.replaceChildren();

    if (totalPages <= 1) {
        return;
    }

    topPagination.appendChild(build());
    bottomPagination.appendChild(build());
}

/**
 * Loads one page of cards.
 * @param {number} page
 */
async function loadCards(page = 1) {
    renderLoading(gallery, "Fetching non-standard frame cards...");

    try {
        const data = await fetchJson(`/api/cards/no-2015-frame?page=${page}`);

        if (!Array.isArray(data.cards) || data.cards.length === 0) {
            renderEmptyState(gallery, {
                title: "No qualifying cards found",
                hint: "No Arena printings match this filter.",
            });
            galleryTitle.textContent = "No printings";
            updatePaginationControls(0, 0);
            return;
        }

        galleryTitle.textContent =
            `${data.non_standard_count} printings · page ${data.current_page} of ${data.total_pages}`;

        gallery.innerHTML = "";
        for (const card of data.cards) {
            gallery.appendChild(createCardItem(card, { showSet: true, modern: Boolean(card.is_modern) }));
        }

        updatePaginationControls(data.current_page, data.total_pages);
    } catch (error) {
        console.error("Error loading cards:", error);
        renderError(gallery, `Error loading cards: ${error.message}`);
        galleryTitle.textContent = "Error";
        updatePaginationControls(0, 0);
    }
}

/**
 * Delegated pagination clicks.
 * @param {MouseEvent} event
 */
function onPaginationClick(event) {
    const button = event.target.closest("button[data-page]");
    if (!button) {
        return;
    }
    loadCards(Number(button.dataset.page));
    window.scrollTo({ top: 0, behavior: "smooth" });
}

topPagination.addEventListener("click", onPaginationClick);
bottomPagination.addEventListener("click", onPaginationClick);

loadCards(1).catch((error) => console.error(error));
