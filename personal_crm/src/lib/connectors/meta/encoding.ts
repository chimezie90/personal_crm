/**
 * Meta (Facebook/Instagram) Encoding Fix
 *
 * Facebook and Instagram export data with broken UTF-8 encoding where
 * UTF-8 byte sequences are stored as individual Latin-1 characters.
 * For example, "ć" (U+0107, UTF-8: C4 87) becomes "\u00c4\u0087".
 *
 * This utility fixes this mojibake by converting the characters back
 * to their proper UTF-8 representation.
 */

/**
 * Fix Facebook/Instagram JSON encoding mojibake
 * Converts malformed \u00XX sequences back to proper UTF-8
 *
 * @param text - The potentially corrupted text from Facebook/Instagram export
 * @returns The fixed UTF-8 text
 */
export function fixMetaEncoding(text: string): string {
  if (!text) return text;

  try {
    // Convert each character to its code point (treating as byte values)
    const bytes = new Uint8Array([...text].map((c) => c.charCodeAt(0)));

    // Decode as UTF-8
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    // If decoding fails (invalid UTF-8 sequence), return original text
    return text;
  }
}

/**
 * Fix encoding in raw JSON string before parsing
 * This handles the \u00XX sequences in the JSON file itself
 *
 * @param jsonString - Raw JSON string from Facebook/Instagram export
 * @returns Fixed JSON string ready for parsing
 */
export function fixMetaJsonEncoding(jsonString: string): string {
  // Match sequences of \u00XX (UTF-8 bytes encoded as Unicode escapes)
  return jsonString.replace(/(?:\\u00[0-9a-fA-F]{2})+/g, (match) => {
    // Extract hex values and convert to byte array
    const bytes: number[] = [];
    const regex = /\\u00([0-9a-fA-F]{2})/g;
    let m;
    while ((m = regex.exec(match)) !== null) {
      bytes.push(parseInt(m[1], 16));
    }

    // Decode UTF-8 bytes to string
    try {
      const decoded = Buffer.from(bytes).toString("utf8");
      // Escape the result for JSON
      return JSON.stringify(decoded).slice(1, -1);
    } catch {
      // If decoding fails, return original
      return match;
    }
  });
}

/**
 * Recursively fix encoding in a parsed object
 * Useful for fixing after JSON.parse if you didn't pre-process the JSON string
 *
 * @param obj - Any object/array/value from parsed JSON
 * @returns The same structure with all strings fixed
 */
export function fixMetaEncodingDeep<T>(obj: T): T {
  if (typeof obj === "string") {
    return fixMetaEncoding(obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(fixMetaEncodingDeep) as T;
  }

  if (obj && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = fixMetaEncodingDeep(value);
    }
    return result as T;
  }

  return obj;
}
