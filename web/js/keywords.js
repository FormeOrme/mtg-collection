import { createCardItem, fetchJson, renderEmptyState, renderError, renderLoading } from "./common.js";
import { renderNav } from "./nav.js";

const gallery = document.getElementById("gallery");
const galleryTitle = document.getElementById("galleryTitle");
const keywordIndex = document.getElementById("keywordIndex");
const expandAllBtn = document.getElementById("expandAllBtn");
const collapseAllBtn = document.getElementById("collapseAllBtn");

const CONTROL_BUTTON_CLASS =
    "inline-flex items-center justify-center rounded-lg border border-line bg-white/[0.03] px-3 py-1.5 " +
    "text-xs font-medium text-muted transition hover:border-line-strong hover:bg-white/[0.06] hover:text-white";

const INDEX_BUTTON_CLASS =
    "rounded-full border border-line bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-muted " +
    "transition hover:border-accent-mid/50 hover:bg-accent-mid/10 hover:text-white";

const SECTION_CLASS = "scroll-mt-20 overflow-hidden rounded-2xl border border-line bg-panel";

const SECTION_HEADER_CLASS =
    "flex w-full cursor-pointer items-center gap-2.5 px-4 py-3 text-left " +
    "text-sm font-semibold text-body transition hover:bg-white/[0.04]";

const SECTION_CONTENT_BASE_CLASS = "overflow-hidden transition-all duration-300";
const SECTION_CONTENT_EXPANDED = ["max-h-[6000px]", "opacity-100"];
const SECTION_CONTENT_COLLAPSED = ["max-h-0", "opacity-0"];

renderNav();

/**
 * Expands a keyword section.
 * @param {HTMLElement} content
 */
function expandSection(content) {
    content.classList.remove(...SECTION_CONTENT_COLLAPSED);
    content.classList.add(...SECTION_CONTENT_EXPANDED);
    content.dataset.expanded = "true";
    const header = content.previousElementSibling;
    header?.setAttribute("aria-expanded", "true");
    const icon = header?.querySelector("[data-accordion-icon]");
    if (icon) {
        icon.textContent = "▼";
    }
}

/**
 * Collapses a keyword section.
 * @param {HTMLElement} content
 */
function collapseSection(content) {
    content.classList.remove(...SECTION_CONTENT_EXPANDED);
    content.classList.add(...SECTION_CONTENT_COLLAPSED);
    content.dataset.expanded = "false";
    const header = content.previousElementSibling;
    header?.setAttribute("aria-expanded", "false");
    const icon = header?.querySelector("[data-accordion-icon]");
    if (icon) {
        icon.textContent = "▶";
    }
}

/**
 * Builds one accordion section for a keyword group.
 * @param {{ keyword: string, count: number, cards: Array<object> }} group
 * @returns {HTMLElement}
 */
function buildSection(group) {
    const section = document.createElement("div");
    section.className = SECTION_CLASS;
    section.id = "section-" + group.keyword.replace(/\s+/g, "-");

    const header = document.createElement("div");
    header.className = SECTION_HEADER_CLASS;
    header.setAttribute("role", "button");
    header.setAttribute("tabindex", "0");
    header.setAttribute("aria-expanded", "false");

    const icon = document.createElement("span");
    icon.className = "inline-flex w-3 shrink-0 justify-center text-[9px] text-subtle";
    icon.textContent = "▶";
    icon.dataset.accordionIcon = "";

    const label = document.createElement("span");
    label.className = "tracking-tight";
    label.textContent = group.keyword;

    const count = document.createElement("span");
    count.className =
        "ml-auto rounded-md border border-line-count bg-count-bg px-1.5 py-0.5 " +
        "text-[11px] font-medium text-count tabular-nums";
    count.textContent = `${group.count} cards`;

    header.append(icon, label, count);

    const content = document.createElement("div");
    content.className = `${SECTION_CONTENT_BASE_CLASS} ${SECTION_CONTENT_COLLAPSED.join(" ")}`;
    content.dataset.expanded = "false";

    const grid = document.createElement("div");
    grid.className =
        "grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-3 border-t border-line p-3 sm:gap-4 sm:p-4";

    for (const card of group.cards) {
        grid.appendChild(createCardItem(card));
    }

    content.appendChild(grid);

    const toggle = () => {
        if (content.dataset.expanded === "true") {
            collapseSection(content);
        } else {
            expandSection(content);
        }
    };

    header.addEventListener("click", toggle);
    header.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggle();
        }
    });

    section.append(header, content);
    return section;
}

/**
 * Loads and renders the keyword groups.
 */
async function loadCards() {
    renderLoading(gallery, "Fetching cards with non-Arena keywords...");

    try {
        const data = await fetchJson("/api/cards/keywords-not-in-arena");
        gallery.innerHTML = "";
        keywordIndex.innerHTML = "";

        if (!Array.isArray(data.keywords) || data.keywords.length === 0) {
            renderEmptyState(gallery, {
                title: "No cards with non-Arena keywords found",
            });
            galleryTitle.textContent = "0 keywords";
            return;
        }

        const allCards = new Set();
        for (const group of data.keywords) {
            for (const card of group.cards) {
                allCards.add(card.name);
            }
        }
        galleryTitle.textContent = `${data.keywords.length} keywords · ${allCards.size} cards`;

        const alphabetical = [...data.keywords].sort((a, b) => a.keyword.localeCompare(b.keyword));
        for (const group of alphabetical) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = INDEX_BUTTON_CLASS;
            button.textContent = `${group.keyword} (${group.count})`;
            button.addEventListener("click", () => {
                const section = document.getElementById("section-" + group.keyword.replace(/\s+/g, "-"));
                if (!section) {
                    return;
                }
                const content = section.querySelector("[data-expanded]");
                if (content) {
                    expandSection(content);
                }
                section.scrollIntoView({ behavior: "smooth", block: "start" });
            });
            keywordIndex.appendChild(button);
        }

        const byDate = [...data.keywords].sort((a, b) => {
            const dateA = a.latestReleaseDate ? Date.parse(a.latestReleaseDate) : 0;
            const dateB = b.latestReleaseDate ? Date.parse(b.latestReleaseDate) : 0;
            return dateB - dateA;
        });

        for (const group of byDate) {
            gallery.appendChild(buildSection(group));
        }
    } catch (error) {
        console.error("Error loading cards:", error);
        renderError(gallery, `Error loading cards: ${error.message}`);
        galleryTitle.textContent = "Error";
    }
}

expandAllBtn.className = CONTROL_BUTTON_CLASS;
collapseAllBtn.className = CONTROL_BUTTON_CLASS;

expandAllBtn.addEventListener("click", () => {
    for (const content of gallery.querySelectorAll("[data-expanded]")) {
        expandSection(content);
    }
});

collapseAllBtn.addEventListener("click", () => {
    for (const content of gallery.querySelectorAll("[data-expanded]")) {
        collapseSection(content);
    }
});

loadCards().catch((error) => console.error(error));
