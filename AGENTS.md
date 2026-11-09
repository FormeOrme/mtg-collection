# Agent Guidelines

## Project context

- Static web pages live in `web/` (plain HTML + ES modules, no bundler).
- Tailwind CSS 4 is loaded from the CDN (`@tailwindcss/browser@4.1`), preceded by
  `web/js/tailwind-theme.js`, which injects the design tokens via an inline
  `@theme` block.
- Shared class recipes live in `web/js/common.js`. Keep every utility class as a
  static string literal so the Tailwind scanner can see it.
- Node scripts live in `scripts/` and are plain ESM (see `package.json`).

## Tailwind CSS rules

These rules are mandatory for any new or edited Tailwind usage, including utility
classes in HTML, JS, and `@apply` in CSS.

### Neutral palette: stone

- Use **`stone`** for every neutral color: backgrounds, surfaces, borders, text,
  placeholders, dividers, and disabled states.
- Examples: `bg-stone-900`, `text-stone-300`, `border-stone-700`, `text-stone-500`.
- Do **not** use `slate`, `gray`, `zinc`, or `neutral` as the neutral palette.
- Project-specific tokens (`canvas`, `panel`, `line`, `body`, `muted`, `subtle`,
  `card-bg`, etc. from `tailwind-theme.js`) remain valid and should be preferred
  for existing surfaces; when a stock neutral scale is needed, use `stone`.

### Semantic colors

| Meaning  | Palette   | Examples                                              |
| -------- | --------- | ----------------------------------------------------- |
| Success  | `emerald` | `text-emerald-400`, `bg-emerald-500/10`, `border-emerald-500/40` |
| Warning  | `amber`   | `text-amber-400`, `bg-amber-500/10`, `border-amber-500/40`   |
| Danger   | `red`     | `text-red-400`, `bg-red-500/10`, `border-red-500/40`         |

- Never use another hue for these meanings (no green for success, no yellow or
  orange for warning, no rose or pink for danger).
- Keep the tier consistent within a component (e.g. text `-400`, background
  `-500/10`, border `-500/40`), and match the opacity conventions already used in
  `web/js/common.js`.
- Existing semantic tokens (`success`, `warning`, `danger` and their `-bg`
  counterparts) should be mapped to emerald, amber, and red respectively when the
  theme is next touched.

### Accent / brand

- The brand accent is **`amber`**, using the same hue family as the warning state
  (e.g. accent `amber-300`/`amber-400`, buttons `amber-500`, deep `amber-600`).
- Because accent and warning share amber, use amber deliberately: it signals
  either brand emphasis or a warning, never both in the same component.
- Do not repurpose emerald or red for branding or emphasis; reserve them for
  their semantic meaning. Neutral surfaces and text stay on `stone`.
