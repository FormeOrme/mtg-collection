document.addEventListener("DOMContentLoaded", () => {
    const gallery = document.getElementById("gallery");
    const galleryTitle = document.getElementById("galleryTitle");
    const keywordIndex = document.getElementById("keywordIndex");
    const expandAllBtn = document.getElementById("expandAllBtn");
    const collapseAllBtn = document.getElementById("collapseAllBtn");

    async function loadCards() {
        gallery.innerHTML = '<div class="loading">Fetching cards with non-Arena keywords...</div>';

        try {
            const response = await fetch("/api/cards/keywords-not-in-arena");
            if (!response.ok) {
                throw new Error(`API returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            gallery.innerHTML = "";
            keywordIndex.innerHTML = "";

            if (!data.keywords || data.keywords.length === 0) {
                gallery.innerHTML = "<div class='empty-state'><div class='empty-state-text'>No cards with non-Arena keywords found.</div></div>";
                galleryTitle.textContent = "0 Keywords Found";
                return;
            }

            // Count total unique cards across all keyword groups
            const allCards = new Set();
            for (const group of data.keywords) {
                for (const card of group.cards) {
                    allCards.add(card.name);
                }
            }
            galleryTitle.textContent = `${data.keywords.length} Keywords, ${allCards.size} Cards`;

            // Dedicated expand/collapse functions
            function expandSection(header, content) {
                content.classList.remove("collapsed");
                header.querySelector(".accordion-icon").textContent = "▼";
            }

            function collapseSection(header, content) {
                content.classList.add("collapsed");
                header.querySelector(".accordion-icon").textContent = "▶";
            }

            // Build keyword index buttons
            for (const group of data.keywords) {
                const btn = document.createElement("button");
                btn.className = "keyword-index-btn";
                btn.textContent = `${group.keyword} (${group.count})`;
                btn.addEventListener("click", () => {
                    const section = document.getElementById("section-" + group.keyword.replace(/\s+/g, "-"));
                    if (section) {
                        const header = section.querySelector(".keyword-section-header");
                        const content = section.querySelector(".keyword-section-content");
                        if (header && content) {
                            expandSection(header, content);
                        }
                        section.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                });
                keywordIndex.appendChild(btn);
            }

            // Render each keyword group as a collapsible accordion
            for (const group of data.keywords) {
                const sectionId = "section-" + group.keyword.replace(/\s+/g, "-");

                // Keyword section
                const section = document.createElement("div");
                section.className = "keyword-section";
                section.id = sectionId;

                // Clickable header
                const header = document.createElement("div");
                header.className = "keyword-section-header";
                header.innerHTML = `<span class="accordion-icon">▶</span> ${group.keyword} <span class="card-count">(${group.count} cards)</span>`;

                // Collapsible content container
                const content = document.createElement("div");
                content.className = "keyword-section-content collapsed";

                // Card grid for this keyword
                const grid = document.createElement("div");
                grid.className = "gallery";

                for (const card of group.cards) {
                    const cardItem = createCardItem(card);
                    grid.appendChild(cardItem);
                }

                content.appendChild(grid);

                header.addEventListener("click", () => {
                    if (content.classList.contains("collapsed")) {
                        expandSection(header, content);
                    } else {
                        collapseSection(header, content);
                    }
                });

                section.appendChild(header);
                section.appendChild(content);
                gallery.appendChild(section);
            }

            // Expand All button
            expandAllBtn.addEventListener("click", () => {
                for (const section of document.querySelectorAll(".keyword-section")) {
                    const header = section.querySelector(".keyword-section-header");
                    const content = section.querySelector(".keyword-section-content");
                    expandSection(header, content);
                }
            });

            // Collapse All button
            collapseAllBtn.addEventListener("click", () => {
                for (const section of document.querySelectorAll(".keyword-section")) {
                    const header = section.querySelector(".keyword-section-header");
                    const content = section.querySelector(".keyword-section-content");
                    collapseSection(header, content);
                }
            });

        } catch (error) {
            console.error("Error loading cards:", error);
            gallery.innerHTML = `
                <div class="error" style="grid-column: 1/-1;">
                    Error loading cards: ${error.message}
                </div>
            `;
            galleryTitle.textContent = "Error";
        }
    }

    loadCards();
});
