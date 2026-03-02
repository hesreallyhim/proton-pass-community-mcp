import { z } from "zod";

import { asJsonTextOrRaw, asTextContent, joinStdoutStderr } from "../pass-cli/output.js";
import type { PassCliRunner } from "../pass-cli/runner.js";
import { requireWriteGate } from "./write-gate.js";

const DEFAULT_ITEM_LIST_PAGE_SIZE = 100;
const MAX_ITEM_LIST_PAGE_SIZE = 250;

type JsonRecord = Record<string, unknown>;

export type ItemRef = {
  id: string;
  share_id: string | null;
  vault_id: string | null;
  title: string | null;
  display_title: string;
  state: string | null;
  create_time: string | null;
  modify_time: string | null;
  uri: string | null;
};

function parseCursor(cursor?: string): number {
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

function asRecord(value: unknown): JsonRecord | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonRecord;
  }
  return null;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function firstString(record: JsonRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = asNonEmptyString(record[key]);
    if (value) return value;
  }
  return null;
}

function firstNestedString(
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

function parsePassUri(uri: string | null): { shareId: string | null; itemId: string | null } {
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

function shortId(value: string): string {
  return value.length <= 8 ? value : value.slice(0, 8);
}

function toItemRef(rawItem: unknown, index: number): ItemRef {
  const item = asRecord(rawItem);
  if (!item) {
    const fallbackId = `item-${index + 1}`;
    return {
      id: fallbackId,
      share_id: null,
      vault_id: null,
      title: null,
      display_title: `[untitled:${shortId(fallbackId)}]`,
      state: null,
      create_time: null,
      modify_time: null,
      uri: null,
    };
  }

  const existingUri = firstString(item, ["uri"]);
  const parsedUri = parsePassUri(existingUri);
  const id =
    firstString(item, ["id", "item_id", "itemId"]) ?? parsedUri.itemId ?? `item-${index + 1}`;
  const shareId =
    firstString(item, ["share_id", "shareId"]) ??
    firstNestedString(item, ["share"], ["id", "share_id", "shareId"]) ??
    parsedUri.shareId;
  const vaultId =
    firstString(item, ["vault_id", "vaultId"]) ??
    firstNestedString(item, ["vault"], ["id", "vault_id", "vaultId"]);
  const title = firstNestedString(item, ["content"], ["title"]) ?? firstString(item, ["title"]);

  const displayTitle = title ?? `[untitled:${shortId(id)}]`;
  const derivedUri = shareId ? `pass://${shareId}/${id}` : existingUri;

  return {
    id,
    share_id: shareId,
    vault_id: vaultId,
    title,
    display_title: displayTitle,
    state: firstString(item, ["state"]),
    create_time: firstString(item, ["create_time", "createTime", "created_at", "createdAt"]),
    modify_time: firstString(item, ["modify_time", "modifyTime", "updated_at", "updatedAt"]),
    uri: derivedUri ?? null,
  };
}

function extractRawItemList(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed;
  const parsedObj = asRecord(parsed);
  if (!parsedObj) return null;
  const items = parsedObj.items;
  return Array.isArray(items) ? items : null;
}

export const listItemsInputSchema = z
  .object({
    vaultName: z.string().optional(),
    shareId: z.string().optional(),
    filterType: z.string().optional(),
    filterState: z.string().optional(),
    sortBy: z.string().optional(),
    pageSize: z.number().int().min(1).max(MAX_ITEM_LIST_PAGE_SIZE).optional(),
    cursor: z.string().optional(),
    output: z.enum(["json", "human"]).default("json"),
  })
  .refine(
    (input) => {
      const hasVaultName = Boolean(input.vaultName);
      const hasShareId = Boolean(input.shareId);
      return hasVaultName !== hasShareId;
    },
    {
      message: "Provide exactly one of vaultName or shareId.",
    },
  );

export const viewItemInputSchema = z.object({
  uri: z.string().optional(),
  shareId: z.string().optional(),
  vaultName: z.string().optional(),
  itemId: z.string().optional(),
  itemTitle: z.string().optional(),
  field: z.string().optional(),
  output: z.enum(["json", "human"]).default("json"),
});

export const createLoginItemInputSchema = z.object({
  shareId: z.string().optional(),
  vaultName: z.string().optional(),
  title: z.string(),
  username: z.string().optional(),
  email: z.string().optional(),
  password: z.string().optional(),
  url: z.string().optional(),
  generatePassword: z.string().optional(),
  output: z.enum(["json", "human"]).default("json"),
  confirm: z.boolean().optional(),
});

export const createItemFromTemplateInputSchema = z.object({
  itemType: z.string(),
  shareId: z.string().optional(),
  vaultName: z.string().optional(),
  templateJson: z.string(),
  output: z.enum(["json", "human"]).default("json"),
  confirm: z.boolean().optional(),
});

export const updateItemInputSchema = z.object({
  shareId: z.string().optional(),
  vaultName: z.string().optional(),
  itemId: z.string().optional(),
  itemTitle: z.string().optional(),
  fields: z.array(z.string()).min(1),
  confirm: z.boolean().optional(),
});

export const deleteItemInputSchema = z.object({
  shareId: z.string(),
  itemId: z.string(),
  confirm: z.boolean().optional(),
});

export type ListItemsInput = z.infer<typeof listItemsInputSchema>;
export type ViewItemInput = z.infer<typeof viewItemInputSchema>;
export type CreateLoginItemInput = z.infer<typeof createLoginItemInputSchema>;
export type CreateItemFromTemplateInput = z.infer<typeof createItemFromTemplateInputSchema>;
export type UpdateItemInput = z.infer<typeof updateItemInputSchema>;
export type DeleteItemInput = z.infer<typeof deleteItemInputSchema>;

export async function listItemsHandler(
  passCli: PassCliRunner,
  { vaultName, shareId, filterType, filterState, sortBy, pageSize, cursor, output }: ListItemsInput,
) {
  if (!vaultName && !shareId) {
    throw new Error("Provide exactly one of vaultName or shareId.");
  }
  if (vaultName && shareId) throw new Error("Provide only one of vaultName or shareId.");
  if (output !== "json" && (pageSize !== undefined || cursor !== undefined)) {
    throw new Error('Pagination is supported only with {"output":"json"}.');
  }

  const args = ["item", "list"];
  if (shareId) args.push("--share-id", shareId);
  else if (vaultName) args.push(vaultName);
  if (filterType) args.push("--filter-type", filterType);
  if (filterState) args.push("--filter-state", filterState);
  if (sortBy) args.push("--sort-by", sortBy);
  args.push("--output", output);

  const { stdout } = await passCli(args);
  if (output !== "json") {
    return asTextContent(asJsonTextOrRaw(stdout));
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return asTextContent(asJsonTextOrRaw(stdout));
  }

  const rawItems = extractRawItemList(parsed);
  if (!rawItems) {
    return asTextContent(asJsonTextOrRaw(stdout));
  }
  const refs = rawItems.map((item, index) => toItemRef(item, index));

  const start = parseCursor(cursor);
  const size = pageSize ?? DEFAULT_ITEM_LIST_PAGE_SIZE;
  const end = start + size;
  const items = refs.slice(start, end);
  const nextCursor = end < refs.length ? String(end) : null;

  const structuredContent = {
    items,
    pageSize: size,
    cursor: String(start),
    returned: items.length,
    total: refs.length,
    nextCursor,
  };

  return {
    content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
  };
}

export async function viewItemHandler(passCli: PassCliRunner, input: ViewItemInput) {
  const { uri, shareId, vaultName, itemId, itemTitle, field, output } = input;

  const usingUri = !!uri;
  const usingSelectors = (shareId || vaultName) && (itemId || itemTitle);

  if (!usingUri && !usingSelectors) {
    throw new Error("Provide either uri OR (shareId|vaultName) AND (itemId|itemTitle).");
  }
  if (usingUri && (shareId || vaultName || itemId || itemTitle)) {
    throw new Error("uri is mutually exclusive with selector arguments.");
  }
  if (shareId && vaultName) throw new Error("shareId and vaultName are mutually exclusive.");
  if (itemId && itemTitle) throw new Error("itemId and itemTitle are mutually exclusive.");

  const args: string[] = ["item", "view"];

  if (usingUri) {
    args.push("--output", output, uri);
  } else {
    if (shareId) args.push("--share-id", shareId);
    else args.push("--vault-name", vaultName!);

    if (itemId) args.push("--item-id", itemId);
    else args.push("--item-title", itemTitle!);

    if (field) args.push("--field", field);
    args.push("--output", output);
  }

  const { stdout } = await passCli(args);
  return asTextContent(asJsonTextOrRaw(stdout));
}

export async function createLoginItemHandler(passCli: PassCliRunner, input: CreateLoginItemInput) {
  requireWriteGate(input.confirm);
  if (input.shareId && input.vaultName)
    throw new Error("Provide only one of shareId or vaultName.");

  const args: string[] = ["item", "create", "login"];
  if (input.shareId) args.push("--share-id", input.shareId);
  else if (input.vaultName) args.push("--vault-name", input.vaultName);

  args.push("--title", input.title);

  if (input.username) args.push("--username", input.username);
  if (input.email) args.push("--email", input.email);
  if (input.password) args.push("--password", input.password);
  if (input.url) args.push("--url", input.url);

  if (input.generatePassword) {
    if (input.generatePassword === "true") args.push("--generate-password");
    else args.push(`--generate-password=${input.generatePassword}`);
  }

  args.push("--output", input.output);

  const { stdout, stderr } = await passCli(args);
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(asJsonTextOrRaw(out));
}

export async function createItemFromTemplateHandler(
  passCli: PassCliRunner,
  input: CreateItemFromTemplateInput,
) {
  requireWriteGate(input.confirm);
  if (input.shareId && input.vaultName)
    throw new Error("Provide only one of shareId or vaultName.");

  const args: string[] = ["item", "create", input.itemType, "--from-template", "-"];
  if (input.shareId) args.push("--share-id", input.shareId);
  else if (input.vaultName) args.push("--vault-name", input.vaultName);

  args.push("--output", input.output);

  const { stdout, stderr } = await passCli(args, input.templateJson);
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(asJsonTextOrRaw(out));
}

export async function updateItemHandler(
  passCli: PassCliRunner,
  { shareId, vaultName, itemId, itemTitle, fields, confirm }: UpdateItemInput,
) {
  requireWriteGate(confirm);
  if (shareId && vaultName) throw new Error("Provide only one of shareId or vaultName.");
  if (itemId && itemTitle) throw new Error("Provide only one of itemId or itemTitle.");
  if (!itemId && !itemTitle) throw new Error("Provide itemId or itemTitle.");

  const args: string[] = ["item", "update"];
  if (shareId) args.push("--share-id", shareId);
  else if (vaultName) args.push("--vault-name", vaultName);

  if (itemId) args.push("--item-id", itemId);
  else args.push("--item-title", itemTitle!);

  for (const field of fields) args.push("--field", field);

  const { stdout, stderr } = await passCli(args);
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(out || "OK");
}

export async function deleteItemHandler(
  passCli: PassCliRunner,
  { shareId, itemId, confirm }: DeleteItemInput,
) {
  requireWriteGate(confirm);
  const { stdout, stderr } = await passCli([
    "item",
    "delete",
    "--share-id",
    shareId,
    "--item-id",
    itemId,
  ]);
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(out || "OK");
}
