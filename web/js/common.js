/**
 * Shared UI helpers and Tailwind class recipes.
 * Every class name is a static string literal so the Tailwind scanner can see it.
 */

export const CARD_ITEM_CLASS =
    "group relative block aspect-[2.5/3.5] cursor-pointer overflow-hidden rounded-xl border border-line-card " +
    "bg-card-bg text-inherit no-underline transition duration-300 ease-out " +
    "hover:-translate-y-1 hover:border-accent-mid/60 hover:shadow-card-hover";

export const CARD_IMAGE_CLASS = "block h-full w-full";

export const CARD_NAME_CLASS =
    "absolute inset-x-0 bottom-0 truncate px-2.5 pb-2 pt-7 text-[0.78rem] font-medium leading-tight text-white";

export const CARD_NAME_BG_CLASS =
    "bg-[linear-gradient(180deg,transparent,rgba(8,9,14,0.92))]";

export const CARD_NAME_BG_RELATED_CLASS =
    "bg-[linear-gradient(180deg,transparent,rgba(79,70,229,0.85))]";

export const CARD_NAME_BG_MODERN_CLASS =
    "bg-[linear-gradient(180deg,transparent,rgba(180,83,9,0.92))]";

export const MODERN_CARD_CLASS =
    "rounded-[4.75%_/_3.5%] outline outline-2 -outline-offset-2 outline-amber-400/90";

export const QTY_BADGE_CLASS =
    "absolute top-2 right-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full " +
    "bg-accent-dark/95 px-1.5 text-[0.72rem] font-semibold text-white ring-1 ring-white/20 " +
    "shadow-[0_4px_12px_rgba(0,0,0,0.55)]";

export const SET_BADGE_CLASS =
    "flex h-14 w-full cursor-pointer items-center gap-2.5 rounded-xl border border-line-badge bg-badge-bg px-3 " +
    "transition duration-200 ease-out hover:-translate-y-0.5 hover:border-accent-mid/50 " +
    "hover:bg-badge-bg-hover hover:shadow-badge-hover";

export const SET_BADGE_ACTIVE_CLASS =
    "border-accent-mid/70 bg-accent-mid/15 shadow-badge-active";

export const SET_ICON_MASK_CLASS =
    "block h-full w-full bg-icon " +
    "[mask-image:var(--icon-url)] [mask-repeat:no-repeat] [mask-position:center] [mask-size:contain]";

export const EMPTY_STATE_WRAPPER_CLASS =
    "col-span-full rounded-2xl border border-dashed border-line bg-gallery-bg px-6 py-20 text-center";
export const EMPTY_STATE_TEXT_CLASS = "text-sm font-medium text-muted";
export const EMPTY_STATE_HINT_CLASS = "mt-1.5 text-xs text-subtle";

export const LOADING_CLASS = "col-span-full py-20 text-center text-sm text-muted";

export const ERROR_CLASS =
    "col-span-full rounded-xl border border-danger/40 bg-danger-bg px-4 py-3 text-sm text-danger";

export const INFO_CLASS =
    "mb-4 rounded-xl border border-line border-l-2 border-l-accent-mid bg-info-bg px-3.5 py-2.5 text-xs text-muted";

export const INFO_WARNING_CLASS =
    "mb-4 rounded-xl border border-line border-l-2 border-l-warning bg-warning-bg px-3.5 py-2.5 text-xs text-warning";

export const INFO_SUCCESS_CLASS =
    "mb-4 rounded-xl border border-line border-l-2 border-l-success bg-success-bg px-3.5 py-2.5 text-xs text-success";

/**
 * Debounces a function.
 * @template {(...args: unknown[]) => void} F
 * @param {F} fn
 * @param {number} delayMs
 * @returns {(...args: Parameters<F>) => void}
 */
export function debounce(fn, delayMs) {
    let timer = null;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delayMs);
    };
}

/**
 * Builds a card tile.
 * @param {{
 *   name: string,
 *   image_uri?: string|null,
 *   scryfall_uri?: string|null,
 *   set?: string|null,
 *   rarity?: string|null,
 * }} card
 * @param {{ showSet?: boolean, modern?: boolean, badge?: string|number|null, className?: string }} [options]
 * @returns {HTMLElement}
 */
export function createCardItem(card, { showSet = false, modern = false, badge = null, className = "" } = {}) {
    const item = card.scryfall_uri ? document.createElement("a") : document.createElement("div");
    item.className = className ? `${CARD_ITEM_CLASS} ${className}` : CARD_ITEM_CLASS;

    if (modern) {
        item.className += ` ${MODERN_CARD_CLASS}`;
    }
    if (card.name) {
        item.dataset.cardName = card.name;
    }
    item.title = `${card.name ?? "Card"} (${card.rarity || "unknown"})`;

    if (card.scryfall_uri) {
        item.href = card.scryfall_uri;
        item.target = "_blank";
        item.rel = "noopener noreferrer";
        item.title += "\nClick to view on Scryfall";
    }

    const img = document.createElement("img");
    if (card.image_uri) {
        img.src = card.image_uri;
        img.alt = card.name ?? "Card";
        img.loading = "lazy";
        img.decoding = "async";
        img.className = CARD_IMAGE_CLASS;
        item.appendChild(img);
    }

    if (badge === null) {
        const overlay = document.createElement("div");
        overlay.dataset.cardNameOverlay = "";
        let overlayClass = `${CARD_NAME_CLASS} `;
        if (modern) {
            overlayClass += CARD_NAME_BG_MODERN_CLASS;
        } else {
            overlayClass += CARD_NAME_BG_CLASS;
        }
        overlay.className = overlayClass;
        overlay.dataset.baseClass = overlayClass;
        overlay.textContent = `${card.name ?? ""}${showSet && card.set ? ` (${card.set.toUpperCase()})` : ""}`;
        item.appendChild(overlay);
    } else {
        const qty = document.createElement("span");
        qty.className = QTY_BADGE_CLASS;
        qty.textContent = String(badge);
        item.appendChild(qty);
    }

    return item;
}

/**
 * Highlights every rendered card sharing a name, and their name overlays.
 * @param {HTMLElement} gallery
 * @param {string|null} cardName
 */
export function highlightMatchingCards(gallery, cardName) {
    for (const item of gallery.querySelectorAll("[data-card-name]")) {
        const related = cardName !== null && item.dataset.cardName === cardName;
        item.classList.toggle("ring-2", related);
        item.classList.toggle("ring-related", related);

        const overlay = item.querySelector("[data-card-name-overlay]");
        if (overlay) {
            const baseClass = overlay.dataset.baseClass || `${CARD_NAME_CLASS} ${CARD_NAME_BG_CLASS}`;
            overlay.className = related ? `${baseClass} ${CARD_NAME_BG_RELATED_CLASS}` : baseClass;
        }
    }
}

/**
 * Wires delegated hover/focus highlighting for a gallery.
 * @param {HTMLElement} gallery
 */
export function enableRelatedHighlight(gallery) {
    const onPointer = (event) => {
        const item = event.target.closest?.("[data-card-name]");
        if (!item || !gallery.contains(item)) {
            return;
        }
        highlightMatchingCards(gallery, item.dataset.cardName);
    };
    const clear = () => highlightMatchingCards(gallery, null);

    gallery.addEventListener("mouseover", onPointer);
    gallery.addEventListener("focusin", onPointer);
    gallery.addEventListener("mouseleave", clear);
    gallery.addEventListener("focusout", clear);
}

/**
 * Renders a standard empty state into a container.
 * @param {HTMLElement} container
 * @param {{ title: string, hint?: string }} state
 */
export function renderEmptyState(container, { title, hint }) {
    container.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = EMPTY_STATE_WRAPPER_CLASS;

    const titleEl = document.createElement("p");
    titleEl.className = EMPTY_STATE_TEXT_CLASS;
    titleEl.textContent = title;

    wrapper.appendChild(titleEl);

    if (hint) {
        const hintEl = document.createElement("p");
        hintEl.className = EMPTY_STATE_HINT_CLASS;
        hintEl.textContent = hint;
        wrapper.appendChild(hintEl);
    }

    container.appendChild(wrapper);
}

/**
 * Renders a loading message into a container.
 * @param {HTMLElement} container
 * @param {string} message
 */
export function renderLoading(container, message) {
    container.innerHTML = "";
    const el = document.createElement("div");
    el.className = LOADING_CLASS;
    el.textContent = message;
    container.appendChild(el);
}

/**
 * Renders an error message into a container.
 * @param {HTMLElement} container
 * @param {string} message
 */
export function renderError(container, message) {
    container.innerHTML = "";
    const el = document.createElement("div");
    el.className = ERROR_CLASS;
    el.textContent = message;
    container.appendChild(el);
}

/**
 * Fetches JSON and throws on a non-ok response.
 * @param {string} url
 * @param {RequestInit} [init]
 * @returns {Promise<unknown>}
 */
export async function fetchJson(url, init) {
    const response = await fetch(url, init);
    if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }
    return response.json();
}
