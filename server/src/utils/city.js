// Shared city helpers for consistent room naming and safe DB matching.

/**
 * Sanitize a city string into a deterministic room-name friendly slug.
 * Example: "New York" -> "new-york"
 */
export function sanitizeCityForRoom(city) {
  if (!city || typeof city !== "string") return "";

  return city
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/**
 * Normalize a city string for exact matching (keeps spaces, collapses repeated whitespace).
 */
export function normalizeCityForMatch(city) {
  if (!city || typeof city !== "string") return "";
  return city.trim().replace(/\s+/g, " ");
}

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a case-insensitive, exact-match regex for a city string.
 * This prevents regex injection / special character surprises.
 */
export function buildCityExactMatchRegex(city) {
  const normalized = normalizeCityForMatch(city);
  return new RegExp(`^${escapeRegex(normalized)}$`, "i");
}
