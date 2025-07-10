// This file defines the structure of Magic: The Gathering card objects
// based on the sampled JSON data from oracle-cards-20250625090309.json.

/**
 * Represents a Magic: The Gathering card.
 * @typedef {Object} Card
 * @property {string} id - The unique identifier for the card.
 * @property {string} name - The name of the card.
 * @property {string} type_line - The type line of the card (e.g., "Creature — Elf Druid").
 * @property {string} [mana_cost] - The mana cost of the card (optional).
 * @property {string[]} [colors] - The colors of the card (optional).
 * @property {Object} [image_uris] - The image URIs for the card (optional).
 * @property {string} [image_uris.small] - The small image URI (optional).
 * @property {string} [image_uris.normal] - The normal image URI (optional).
 * @property {Object} legalities - The legalities of the card in different formats.
 * @property {string} legalities.standard - The legality in the Standard format.
 * @property {string} legalities.modern - The legality in the Modern format.
 * @property {string} legalities.commander - The legality in the Commander format.
 */

// Example usage:
// const card = {
//   id: "12345",
//   name: "Llanowar Elves",
//   type_line: "Creature — Elf Druid",
//   mana_cost: "{G}",
//   colors: ["G"],
//   image_uris: {
//     small: "https://example.com/small.jpg",
//     normal: "https://example.com/normal.jpg"
//   },
//   legalities: {
//     standard: "legal",
//     modern: "legal",
//     commander: "legal"
//   }
// };
