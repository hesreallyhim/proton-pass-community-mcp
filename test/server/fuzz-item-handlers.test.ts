import * as fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";

import { createServer } from "../../src/server.js";

import { makeRunner, restoreProcessEnvAndMocks } from "./test-support.js";

const TOKEN_CHARS = [..."abcdefghijklmnopqrstuvwxyz0123456789"];
const LABEL_CHARS = [..."abcdefghijklmnopqrstuvwxyz0123456789 -"];
const ITEM_REF_KEYS = [
  "create_time",
  "display_title",
  "id",
  "modify_time",
  "share_id",
  "state",
  "title",
  "type",
  "uri",
  "vault_id",
].sort();

const tokenArb = fc
  .array(fc.constantFrom(...TOKEN_CHARS), { minLength: 1, maxLength: 16 })
  .map((chars) => chars.join(""));

const labelArb = fc
  .array(fc.constantFrom(...LABEL_CHARS), { maxLength: 24 })
  .map((chars) => chars.join(""));

const secretArb = fc.nat(1_000_000).map((value) => `SECRET_${value}`);

const scalarMetadataArb = fc.oneof(
  labelArb,
  fc.integer({ min: -1000, max: 1000 }),
  fc.boolean(),
  fc.constant(null),
);

const typedContentArb = fc
  .record({
    typeKey: fc.constantFrom("Login", "CreditCard", "SSHKey", "Wifi", "MyCustomType"),
    secret: secretArb,
  })
  .map(({ typeKey, secret }) => ({
    [typeKey]: typeKey === "Login" ? { username: "demo", password: secret } : { opaque: secret },
  }));

const itemLikeArb = fc.record({
  id: fc.option(tokenArb, { nil: undefined }),
  item_id: fc.option(tokenArb, { nil: undefined }),
  share_id: fc.option(tokenArb, { nil: undefined }),
  vault_id: fc.option(tokenArb, { nil: undefined }),
  uri: fc.option(
    fc.oneof(
      fc.tuple(tokenArb, tokenArb).map(([shareId, itemId]) => `pass://${shareId}/${itemId}`),
      labelArb,
    ),
    { nil: undefined },
  ),
  state: fc.option(tokenArb, { nil: undefined }),
  create_time: fc.option(tokenArb, { nil: undefined }),
  modify_time: fc.option(tokenArb, { nil: undefined }),
  title: fc.option(labelArb, { nil: undefined }),
  password: fc.option(secretArb, { nil: undefined }),
  share: fc.option(
    fc.record({
      id: fc.option(tokenArb, { nil: undefined }),
      share_id: fc.option(tokenArb, { nil: undefined }),
    }),
    { nil: undefined },
  ),
  vault: fc.option(
    fc.record({
      id: fc.option(tokenArb, { nil: undefined }),
      vault_id: fc.option(tokenArb, { nil: undefined }),
    }),
    { nil: undefined },
  ),
  content: fc.option(
    fc.record({
      title: fc.option(labelArb, { nil: undefined }),
      password: fc.option(secretArb, { nil: undefined }),
      content: fc.option(typedContentArb, { nil: undefined }),
    }),
    { nil: undefined },
  ),
  metadata: fc.option(fc.dictionary(tokenArb, scalarMetadataArb, { maxKeys: 4 }), {
    nil: undefined,
  }),
});

const rawEntryArb = fc.oneof(
  itemLikeArb,
  tokenArb,
  fc.integer({ min: -1000, max: 1000 }),
  fc.boolean(),
  fc.constant(null),
  fc.array(scalarMetadataArb, { maxLength: 4 }),
);

const payloadScenarioArb = fc
  .record({
    mode: fc.constantFrom("array", "items-object", "single-array-key"),
    items: fc.array(rawEntryArb, { maxLength: 25 }),
    extraKey: tokenArb.filter((key) => key !== "items"),
  })
  .map((scenario) => ({
    ...scenario,
    payload: buildPayload(scenario.mode, scenario.items, scenario.extraKey),
  }));

const paginationArb = fc.record({
  cursor: fc.nat(40),
  pageSize: fc.integer({ min: 1, max: 25 }),
});

afterEach(restoreProcessEnvAndMocks);

describe("fuzz: item handlers", () => {
  it("listItemsHandler normalizes arbitrary CLI payloads into redacted item refs", async () => {
    await fc.assert(
      fc.asyncProperty(payloadScenarioArb, paginationArb, async (scenario, pagination) => {
        const runner = makeRunner({
          stdout: JSON.stringify(scenario.payload),
          stderr: "",
        });
        const tools = getRegisteredTools(runner);

        const result = (await tools.list_items.handler({
          shareId: "share-scope",
          output: "json",
          cursor: String(pagination.cursor),
          pageSize: pagination.pageSize,
        })) as {
          content: Array<{ type: string; text: string }>;
          structuredContent: {
            items: Array<Record<string, unknown>>;
            pageSize: number;
            cursor: string;
            returned: number;
            total: number;
            nextCursor: string | null;
          };
        };

        const expectedReturned = expectedPageLength(
          scenario.items.length,
          pagination.cursor,
          pagination.pageSize,
        );
        const structured = result.structuredContent;

        expect(JSON.parse(result.content[0]?.text ?? "null")).toEqual(structured);
        expect(structured.total).toBe(scenario.items.length);
        expect(structured.pageSize).toBe(pagination.pageSize);
        expect(structured.cursor).toBe(String(pagination.cursor));
        expect(structured.returned).toBe(expectedReturned);
        expect(structured.items).toHaveLength(expectedReturned);
        expect(structured.nextCursor).toBe(
          pagination.cursor + pagination.pageSize < scenario.items.length
            ? String(pagination.cursor + pagination.pageSize)
            : null,
        );

        for (const item of structured.items) {
          expect(Object.keys(item).sort()).toEqual(ITEM_REF_KEYS);
          expect(typeof item.id).toBe("string");
          expect((item.id as string).length).toBeGreaterThan(0);
          expect(typeof item.display_title).toBe("string");
          expect((item.display_title as string).length).toBeGreaterThan(0);

          if (typeof item.share_id === "string") {
            expect(item.uri).toBe(`pass://${item.share_id}/${item.id}`);
          }

          if (typeof item.type === "string") {
            expect(item.type).toMatch(/^[a-z0-9-]+$/);
          }
        }

        const rendered = JSON.stringify(structured);
        for (const secret of collectSecrets(scenario.payload)) {
          expect(rendered).not.toContain(secret);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("searchItemsHandler matches normalized titles across arbitrary payloads", async () => {
    await fc.assert(
      fc.asyncProperty(
        payloadScenarioArb,
        paginationArb,
        fc.record({
          query: tokenArb,
          match: fc.constantFrom("contains", "prefix", "exact"),
          caseSensitive: fc.boolean(),
        }),
        async (scenario, pagination, search) => {
          const listRunner = makeRunner({
            stdout: JSON.stringify(scenario.payload),
            stderr: "",
          });
          const baselineTools = getRegisteredTools(listRunner);
          const baseline = (await baselineTools.list_items.handler({
            shareId: "share-scope",
            output: "json",
          })) as {
            structuredContent: {
              items: Array<{ id: string; title: string | null }>;
            };
          };

          const expectedMatches = baseline.structuredContent.items.filter(
            (item) =>
              item.title !== null &&
              titleMatches(item.title, search.query, search.match, search.caseSensitive),
          );

          const searchRunner = makeRunner({
            stdout: JSON.stringify(scenario.payload),
            stderr: "",
          });
          const searchTools = getRegisteredTools(searchRunner);
          const result = (await searchTools.search_items.handler({
            query: search.query,
            field: "title",
            match: search.match,
            caseSensitive: search.caseSensitive,
            shareId: "share-scope",
            cursor: String(pagination.cursor),
            pageSize: pagination.pageSize,
          })) as {
            content: Array<{ type: string; text: string }>;
            structuredContent: {
              items: Array<{ id: string; title: string | null }>;
              pageSize: number;
              cursor: string;
              returned: number;
              total: number;
              nextCursor: string | null;
              queryMeta: {
                field: string;
                match: string;
                caseSensitive: boolean;
              };
            };
          };

          const expectedSlice = expectedMatches.slice(
            pagination.cursor,
            pagination.cursor + pagination.pageSize,
          );
          const structured = result.structuredContent;

          expect(JSON.parse(result.content[0]?.text ?? "null")).toEqual(structured);
          expect(structured.total).toBe(expectedMatches.length);
          expect(structured.pageSize).toBe(pagination.pageSize);
          expect(structured.cursor).toBe(String(pagination.cursor));
          expect(structured.returned).toBe(expectedSlice.length);
          expect(structured.items).toHaveLength(expectedSlice.length);
          expect(structured.nextCursor).toBe(
            pagination.cursor + pagination.pageSize < expectedMatches.length
              ? String(pagination.cursor + pagination.pageSize)
              : null,
          );
          expect(structured.queryMeta).toEqual({
            field: "title",
            match: search.match,
            caseSensitive: search.caseSensitive,
          });
          expect(structured.items.map((item) => item.id)).toEqual(
            expectedSlice.map((item) => item.id),
          );

          const rendered = JSON.stringify(structured);
          for (const secret of collectSecrets(scenario.payload)) {
            expect(rendered).not.toContain(secret);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

function buildPayload(
  mode: "array" | "items-object" | "single-array-key",
  items: unknown[],
  extraKey: string,
) {
  if (mode === "array") return items;
  if (mode === "items-object") return { items, meta: "fuzz" };
  return { [extraKey]: items, meta: "fuzz" };
}

function expectedPageLength(total: number, cursor: number, pageSize: number): number {
  if (cursor >= total) return 0;
  return Math.min(pageSize, total - cursor);
}

function collectSecrets(value: unknown, found = new Set<string>()): string[] {
  if (typeof value === "string") {
    if (value.startsWith("SECRET_")) {
      found.add(value);
    }
    return [...found];
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectSecrets(entry, found);
    }
    return [...found];
  }

  if (value && typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      collectSecrets(nested, found);
    }
  }

  return [...found];
}

function titleMatches(
  candidate: string,
  query: string,
  match: "contains" | "prefix" | "exact",
  caseSensitive: boolean,
): boolean {
  const left = caseSensitive ? candidate : candidate.toLowerCase();
  const right = caseSensitive ? query : query.toLowerCase();

  if (match === "exact") return left === right;
  if (match === "prefix") return left.startsWith(right);
  return left.includes(right);
}

function getRegisteredTools(runner: ReturnType<typeof makeRunner>) {
  const server = createServer({ runPassCli: runner });
  return (server as any)._registeredTools as Record<
    string,
    { handler: (input?: unknown) => Promise<unknown> }
  >;
}
