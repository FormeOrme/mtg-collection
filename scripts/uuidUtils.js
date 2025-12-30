import { webcrypto as crypto } from "crypto";

/**
 * Hashes a UUID string using SHA-256 and returns the hex string.
 * @param {string} uuid - The UUID to hash.
 * @returns {Promise<string>} The SHA-256 hash as a hex string.
 */
async function hashUUID(uuid) {
    const encoder = new TextEncoder();
    const data = encoder.encode(uuid);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Converts a hexadecimal hash string to a BigInt.
 * @param {string} hashHex - The hash as a hex string.
 * @returns {BigInt} The hash as a BigInt.
 */
function hashToInt(hashHex) {
    return BigInt("0x" + hashHex);
}

/**
 * Shortens a hash integer to a value within the range [0, maxElements).
 * @param {BigInt} hashInt - The hash as a BigInt.
 * @param {number|BigInt} maxElements - The upper bound (exclusive) for the result.
 * @returns {BigInt} The shortened integer.
 */
function shortenHash(hashInt, maxElements) {
    return hashInt % BigInt(maxElements);
}

/**
 * Encodes a number as a fixed-length base36 string, padded with zeros if necessary.
 * @param {number|BigInt} num - The number to encode.
 * @param {number|BigInt} maxElements - The maximum number of elements (determines length).
 * @returns {string} The base36-encoded string.
 */
function intToFixedBase36(num, maxElements) {
    const maxLength = Math.max(1, Math.floor(Math.log(maxElements) / Math.log(36)) + 1);
    return num.toString(36).padStart(maxLength, "0");
}

/**
 * Hashes a UUID, shortens it to a range, and encodes as a fixed-length base36 string.
 * @param {string} uuid - The UUID to hash and shorten.
 * @param {number|BigInt} [maxElements=10_000_000_000] - The maximum number of unique elements.
 * @returns {Promise<{hashHex: string, shortId: number, shortStr: string}>} An object with the hash, shortened integer, and base36 string.
 */
export async function hashAndShortenUUID(uuid, maxElements = 10_000_000_000) {
    const hashHex = await hashUUID(uuid);
    const hashInt = hashToInt(hashHex);
    const shortId = shortenHash(hashInt, maxElements);
    const shortStr = intToFixedBase36(shortId, maxElements);

    return {
        hashHex,
        shortId: Number(shortId),
        shortStr,
    };
}
