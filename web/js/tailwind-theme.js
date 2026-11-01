/**
 * Injects the Tailwind design tokens before the CDN build initialises.
 * Must be loaded as a classic (blocking) script, before @tailwindcss/browser.
 *
 * Palette: graphite canvas, indigo → violet accent, no webfont (system UI stack).
 */
const theme = document.createElement("style");
theme.type = "text/tailwindcss";
theme.textContent = `
  @theme {
    --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    --font-mono: ui-monospace, "Cascadia Mono", "Segoe UI Mono", Menlo, Consolas, monospace;

    /* Brand: indigo → violet */
    --color-accent: #a5b4fc;
    --color-accent-mid: #818cf8;
    --color-accent-dark: #6366f1;
    --color-accent-deep: #4f46e5;
    --color-accent-2: #c084fc;

    /* Text */
    --color-body: #e7e9f0;
    --color-input: #eef0f7;
    --color-muted: #9aa2b5;
    --color-subtle: #6c7489;
    --color-placeholder: #5b6478;
    --color-count: #c7d2fe;
    --color-icon: #cbd5e1;
    --color-related: #c4b5fd;
    --color-warning: #fcd34d;
    --color-success: #6ee7b7;
    --color-danger: #fda4af;

    /* Surfaces */
    --color-canvas: #0a0b10;
    --color-canvas-end: #0e1017;
    --color-panel: rgb(255 255 255 / 0.03);
    --color-panel-hover: rgb(255 255 255 / 0.06);
    --color-gallery-bg: rgb(255 255 255 / 0.015);
    --color-card-bg: rgb(17 19 27 / 0.9);
    --color-input-bg: rgb(8 9 14 / 0.75);
    --color-badge-bg: rgb(255 255 255 / 0.04);
    --color-badge-bg-hover: rgb(129 140 248 / 0.12);
    --color-count-bg: rgb(129 140 248 / 0.14);
    --color-info-bg: rgb(129 140 248 / 0.10);
    --color-warning-bg: rgb(252 211 77 / 0.10);
    --color-success-bg: rgb(110 231 183 / 0.10);
    --color-danger-bg: rgb(253 164 175 / 0.10);

    /* Borders */
    --color-line: rgb(255 255 255 / 0.08);
    --color-line-strong: rgb(255 255 255 / 0.16);
    --color-line-input: rgb(255 255 255 / 0.12);
    --color-line-badge: rgb(255 255 255 / 0.09);
    --color-line-card: rgb(255 255 255 / 0.07);
    --color-line-count: rgb(129 140 248 / 0.22);

    /* Shadows */
    --shadow-btn-hover: 0 10px 24px -12px rgb(99 102 241 / 0.9);
    --shadow-badge-hover: 0 10px 24px -14px rgb(99 102 241 / 0.8);
    --shadow-badge-active: 0 0 0 1px rgb(129 140 248 / 0.45), 0 12px 28px -16px rgb(99 102 241 / 0.9);
    --shadow-card-hover: 0 18px 40px -18px rgb(0 0 0 / 0.9), 0 0 0 1px rgb(129 140 248 / 0.3);
    --shadow-focus: 0 0 0 3px rgb(99 102 241 / 0.25);
  }
`;
document.head.appendChild(theme);
