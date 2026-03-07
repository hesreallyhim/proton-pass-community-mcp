export type JsonRecord = Record<string, unknown>;

/**
 * Returns the value as a plain object when possible.
 */
export function asRecord(value: unknown): JsonRecord | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonRecord;
  }
  return null;
}

/**
 * Returns a trimmed string when the input is a non-empty string.
 */
export function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Returns the first non-empty string found for the provided keys.
 */
export function firstString(record: JsonRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = asNonEmptyString(record[key]);
    if (value) return value;
  }
  return null;
}

/**
 * Returns the first non-empty string found in nested object candidates.
 */
export function firstNestedString(
  record: JsonRecord,
  objectKeys: string[],
  valueKeys: string[],
): string | null {
  for (const objectKey of objectKeys) {
    const nested = asRecord(record[objectKey]);
    if (!nested) continue;
    const value = firstString(nested, valueKeys);
    if (value) return value;
  }
  return null;
}

/**
 * Parses a pass:// URI into share/item IDs when present.
 */
export function parsePassUri(uri: string | null): {
  shareId: string | null;
  itemId: string | null;
} {
  if (!uri) return { shareId: null, itemId: null };
  const normalized = uri.trim();
  if (!normalized.startsWith("pass://")) {
    return { shareId: null, itemId: null };
  }

  const segments = normalized
    .slice("pass://".length)
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length < 2) return { shareId: null, itemId: null };
  return {
    shareId: segments[0] ?? null,
    itemId: segments[1] ?? null,
  };
}

/**
 * Builds a short stable suffix for fallback display labels.
 */
export function shortId(value: string): string {
  return value.length <= 8 ? value : value.slice(0, 8);
}

/**
 * Normalizes raw typed-content keys to kebab-case filter token style.
 */
export function normalizeItemTypeKey(rawTypeKey: string): string | null {
  const compact = rawTypeKey.replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (!compact) return null;

  const knownMap: Record<string, string> = {
    note: "note",
    login: "login",
    alias: "alias",
    creditcard: "credit-card",
    identity: "identity",
    sshkey: "ssh-key",
    wifi: "wifi",
    custom: "custom",
  };

  if (knownMap[compact]) return knownMap[compact];

  const fallback = rawTypeKey
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();

  return fallback || null;
}

/**
 * Extracts typed content key from content.content.<Type> and normalizes it.
 */
export function extractItemType(item: JsonRecord): string | null {
  const content = asRecord(item.content);
  const nestedTypedContent = asRecord(content?.content);
  if (!nestedTypedContent) return null;

  const typeKeys = Object.keys(nestedTypedContent).filter((key) => key.trim().length > 0);
  if (typeKeys.length === 0) return null;
  return normalizeItemTypeKey(typeKeys[0]);
}
