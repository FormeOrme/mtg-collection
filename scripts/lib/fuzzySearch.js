/**
 * Normalizes free text for fuzzy search.
 * @param {string} value
 * @returns {string}
 */
export function normalizeSearchText(value) {
    return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9 ]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Counts alphabetic letters in a query string.
 * @param {string} value
 * @returns {number}
 */
export function countAlphabeticLetters(value) {
    const matches = String(value || "").match(/[a-z]/gi);
    return matches ? matches.length : 0;
}

/**
 * Computes Levenshtein distance with a max threshold bailout.
 *
 * A lower threshold is stricter.
 *
 * @param {string} left
 * @param {string} right
 * @param {number} threshold
 * @returns {number}
 */
export function levenshteinDistance(left, right, threshold) {
    if (left === right) {
        return 0;
    }

    const leftLength = left.length;
    const rightLength = right.length;

    if (Math.abs(leftLength - rightLength) > threshold) {
        return threshold + 1;
    }

    let previous = new Array(rightLength + 1);
    let current = new Array(rightLength + 1);

    for (let j = 0; j <= rightLength; j += 1) {
        previous[j] = j;
    }

    for (let i = 1; i <= leftLength; i += 1) {
        current[0] = i;
        let minInRow = current[0];

        for (let j = 1; j <= rightLength; j += 1) {
            const substitutionCost = left[i - 1] === right[j - 1] ? 0 : 1;
            current[j] = Math.min(
                current[j - 1] + 1,
                previous[j] + 1,
                previous[j - 1] + substitutionCost,
            );
            if (current[j] < minInRow) {
                minInRow = current[j];
            }
        }

        if (minInRow > threshold) {
            return threshold + 1;
        }

        const tmp = previous;
        previous = current;
        current = tmp;
    }

    return previous[rightLength];
}

/**
 * Determines whether a card name matches a query under fuzzy rules.
 * Handles double-faced card names separated by " // ".
 * @param {string} query - Already normalized query string.
 * @param {string} candidate - Already normalized candidate string.
 * @param {number} threshold
 * @returns {boolean}
 */
export function isFuzzyMatch(query, candidate, threshold) {
    if (!query || !candidate) {
        return false;
    }

    if (candidate.includes(query)) {
        return true;
    }

    const candidateParts = candidate.split(" // ");
    for (const part of candidateParts) {
        if (part.includes(query)) {
            return true;
        }

        const distance = levenshteinDistance(query, part, threshold);
        if (distance <= threshold) {
            return true;
        }
    }

    return levenshteinDistance(query, candidate, threshold) <= threshold;
}
