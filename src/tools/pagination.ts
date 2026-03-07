import { asRecord } from "./item-utils.js";

export function parseCursor(cursor?: string): number {
  if (!cursor) return 0;
  if (!/^\d+$/.test(cursor)) {
    throw new Error('Invalid cursor. Expected a non-negative integer string (example: "100").');
  }

  const parsed = Number(cursor);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error("Invalid cursor. Value is too large.");
  }
  return parsed;
}

export function extractArrayFromParsed(parsed: unknown, candidateKeys: string[]): unknown[] | null {
  if (Array.isArray(parsed)) return parsed;

  const parsedObj = asRecord(parsed);
  if (!parsedObj) return null;

  for (const key of candidateKeys) {
    const value = parsedObj[key];
    if (Array.isArray(value)) return value;
  }

  const arrayValues = Object.values(parsedObj).filter((value) => Array.isArray(value));
  if (arrayValues.length === 1) {
    return arrayValues[0] as unknown[];
  }

  return null;
}

export function paginateRefs<T>(
  refs: T[],
  cursor: string | undefined,
  pageSize: number | undefined,
  defaultPageSize: number,
) {
  const start = parseCursor(cursor);
  const size = pageSize ?? defaultPageSize;
  const end = start + size;
  const items = refs.slice(start, end);
  const nextCursor = end < refs.length ? String(end) : null;

  return {
    items,
    pageSize: size,
    cursor: String(start),
    returned: items.length,
    total: refs.length,
    nextCursor,
  };
}
