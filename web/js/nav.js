/**
 * Shared sticky navigation bar, rendered into the element with id "nav".
 * The active page is derived from <body data-nav="…">.
 */

const PAGES = [
    {id: "index", href: "./", label: "Card Art"},
    {id: "multi-rarity", href: "./multi-rarity.html", label: "Multi-Rarity"},
    {id: "decklist", href: "./decklist.html", label: "Decklist"},
    {id: "keywords", href: "./keywords.html", label: "Keywords"},
    {id: "frame", href: "./frame.html", label: "Frames"},
];

const LAYOUT_CLASS =
    "mx-auto flex h-14 w-full max-w-[1440px] items-center gap-4 px-4 sm:px-6 lg:px-8";

const BRAND_CLASS =
    "flex shrink-0 items-center gap-2.5 text-sm font-semibold tracking-tight text-stone-50 no-underline";

const MARK_CLASS =
    "inline-flex h-7 w-7 items-center justify-center rounded-lg " +
    "bg-[linear-gradient(135deg,var(--color-accent-dark),var(--color-accent-2))] " +
    "text-[11px] font-bold text-stone-950 shadow-btn-hover";

const NAV_CLASS =
    "flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]";

const LINK_CLASS =
    "shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium text-muted " +
    "no-underline transition hover:bg-stone-50/5 hover:text-stone-50";

const CURRENT_LINK_CLASS =
    "shrink-0 whitespace-nowrap rounded-lg bg-stone-50/10 px-3 py-1.5 text-[13px] font-medium text-stone-50 no-underline";

/**
 * Builds the brand link.
 * @returns {HTMLAnchorElement}
 */
function buildBrand() {
    const brand = document.createElement("a");
    brand.href = "./";
    brand.className = BRAND_CLASS;

    const mark = document.createElement("span");
    mark.className = MARK_CLASS;
    mark.textContent = "M";
    mark.setAttribute("aria-hidden", "true");

    const label = document.createElement("span");
    label.className = "hidden sm:inline";
    label.textContent = "MTG Arena";

    brand.append(mark, label);
    return brand;
}

/**
 * Renders the navigation bar.
 */
export function renderNav() {
    const host = document.getElementById("nav");
    if (!host) {
        return;
    }

    host.className = "sticky top-0 z-40 border-b border-line bg-canvas/80 backdrop-blur-xl";

    const current = document.body.dataset.nav;
    const layout = document.createElement("div");
    layout.className = LAYOUT_CLASS;

    const nav = document.createElement("nav");
    nav.className = NAV_CLASS;
    nav.setAttribute("aria-label", "Main");

    for (const page of PAGES) {
        const isCurrent = page.id === current;
        const el = isCurrent ? document.createElement("span") : document.createElement("a");
        el.className = isCurrent ? CURRENT_LINK_CLASS : LINK_CLASS;
        el.textContent = page.label;

        if (isCurrent) {
            el.setAttribute("aria-current", "page");
        } else {
            el.href = page.href;
        }

        nav.appendChild(el);
    }

    layout.append(buildBrand(), nav);
    host.replaceChildren(layout);
}
