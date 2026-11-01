/**
 * Normalizes text by decomposing it (NFD) and removing combining diacritical marks.
 * `"Lórien"` → `"Lorien"`, `"Æther"` is left unchanged.
 * @param {string|null|undefined} value - Text to normalize.
 * @returns {string|undefined} The de-accented text, or `undefined` when `value` is nullish.
 */
export const normalize = (value) => value?.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * Builds a stable slug used as the key of a card row in the barebone artifact.
 *
 * Steps: normalize accents, keep only the text before the first `/` (split-card
 * names such as `"Fire // Ice"` become `"Fire"`), trim, collapse every run of
 * non-word characters into a single `_`, then lowercase.
 * `"Jace, the Mind Sculptor"` → `"jace_the_mind_sculptor"`.
 * @param {string|null|undefined} value - Text to slugify, usually a card name.
 * @returns {string|undefined} The slug, or `undefined` when `value` is nullish.
 */
export const slugify = (value) => normalize(value)?.split("/")[0]?.trim().replace(/\W+/g, "_").toLowerCase();
