/**
 * Injects the Tailwind design tokens before the CDN build initialises.
 * Must be loaded as a classic (blocking) script, before @tailwindcss/browser.
 *
 * Palette: stone neutrals, amber accent (shared with warning),
 * emerald/amber/red semantics, no webfont (system UI stack).
 */
const theme = document.createElement("style");
theme.type = "text/tailwindcss";
theme.textContent = `
  @theme {
    --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    --font-mono: ui-monospace, "Cascadia Mono", "Segoe UI Mono", Menlo, Consolas, monospace;

    /* Brand: amber accent (same hue family as the warning state) */
    --color-accent: #fcd34d;      /* amber-300 */
    --color-accent-mid: #fbbf24;  /* amber-400 */
    --color-accent-dark: #f59e0b; /* amber-500 */
    --color-accent-deep: #d97706; /* amber-600 */
    --color-accent-2: #fde68a;    /* amber-200 */

    /* Text */
    --color-body: #e7e5e4;        /* stone-200 */
    --color-input: #f5f5f4;       /* stone-100 */
    --color-muted: #a8a29e;       /* stone-400 */
    --color-subtle: #78716c;      /* stone-500 */
    --color-placeholder: #57534e; /* stone-600 */
    --color-count: #d6d3d1;       /* stone-300 */
    --color-icon: #d6d3d1;        /* stone-300 */
    --color-related: #fde68a;     /* amber-200 */
    --color-warning: #fcd34d;     /* amber-300 */
    --color-success: #6ee7b7;     /* emerald-300 */
    --color-danger: #fca5a5;      /* red-300 */

    /* Surfaces */
    --color-canvas: #0c0a09;      /* stone-950 */
    --color-canvas-end: #141210;
    --color-panel: rgb(250 250 249 / 0.03);
    --color-panel-hover: rgb(250 250 249 / 0.06);
    --color-gallery-bg: rgb(250 250 249 / 0.015);
    --color-card-bg: rgb(28 25 23 / 0.9);    /* stone-900 */
    --color-input-bg: rgb(12 10 9 / 0.75);   /* stone-950 */
    --color-badge-bg: rgb(250 250 249 / 0.04);
    --color-badge-bg-hover: rgb(251 191 36 / 0.12);   /* amber-400 */
    --color-count-bg: rgb(251 191 36 / 0.14);         /* amber-400 */
    --color-info-bg: rgb(251 191 36 / 0.10);          /* amber-400 */
    --color-warning-bg: rgb(252 211 77 / 0.10);   /* amber-300 */
    --color-success-bg: rgb(110 231 183 / 0.10);  /* emerald-300 */
    --color-danger-bg: rgb(252 165 165 / 0.10);   /* red-300 */

    /* Borders */
    --color-line: rgb(250 250 249 / 0.08);
    --color-line-strong: rgb(250 250 249 / 0.16);
    --color-line-input: rgb(250 250 249 / 0.12);
    --color-line-badge: rgb(250 250 249 / 0.09);
    --color-line-card: rgb(250 250 249 / 0.07);
    --color-line-count: rgb(251 191 36 / 0.22);       /* amber-400 */

    /* Shadows */
    --shadow-btn-hover: 0 10px 24px -12px rgb(245 158 11 / 0.9);
    --shadow-badge-hover: 0 10px 24px -14px rgb(245 158 11 / 0.8);
    --shadow-badge-active: 0 0 0 1px rgb(251 191 36 / 0.45), 0 12px 28px -16px rgb(245 158 11 / 0.9);
    --shadow-card-hover: 0 18px 40px -18px rgb(0 0 0 / 0.9), 0 0 0 1px rgb(251 191 36 / 0.3);
    --shadow-focus: 0 0 0 3px rgb(245 158 11 / 0.25);
  }
`;
document.head.appendChild(theme);
