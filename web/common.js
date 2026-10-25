/**
 * Creates a card item element for display in a gallery grid.
 * @param {{name: string, image_uri: string, scryfall_uri?: string, set?: string, rarity?: string}} card
 * @returns {HTMLElement}
 */
function createCardItem(card) {
    const cardItem = card.scryfall_uri
        ? document.createElement("a")
        : document.createElement("div");

    cardItem.className = "card-item";
    cardItem.dataset.cardName = card.name;
    cardItem.title = `${card.name} (${card.rarity || "unknown"})\nClick to view on Scryfall`;

    if (card.scryfall_uri) {
        cardItem.href = card.scryfall_uri;
        cardItem.target = "_blank";
        cardItem.rel = "noopener noreferrer";
    }

    const img = document.createElement("img");
    img.src = card.image_uri;
    img.alt = card.name;
    img.className = "card-image";
    img.loading = "lazy";

    const nameOverlay = document.createElement("div");
    nameOverlay.className = "card-name";
    nameOverlay.textContent = card.name;

    cardItem.appendChild(img);
    cardItem.appendChild(nameOverlay);

    return cardItem;
}
