import { z } from "zod";

import { asJsonTextOrRaw, asTextContent, joinStdoutStderr } from "../pass-cli/output.js";
import type { PassCliRunner } from "../pass-cli/runner.js";
import {
  asRecord,
  extractItemType,
  firstNestedString,
  firstString,
  parsePassUri,
  shortId,
} from "./item-utils.js";
import { requireWriteGate } from "./write-gate.js";

const DEFAULT_ITEM_LIST_PAGE_SIZE = 100;
const MAX_ITEM_LIST_PAGE_SIZE = 250;
const ITEM_FILTER_TYPES = [
  "note",
  "login",
  "alias",
  "credit-card",
  "identity",
  "ssh-key",
  "wifi",
  "custom",
] as const;
const ITEM_FILTER_STATES = ["active", "trashed"] as const;
const ITEM_SORT_OPTIONS = [
  "alphabetic-asc",
  "alphabetic-desc",
  "created-asc",
  "created-desc",
] as const;
const WIFI_SECURITY_OPTIONS = ["wpa", "wpa2", "wpa3", "wep", "open", "none"] as const;
const VAULT_NAME_SCOPE_DESCRIPTION =
  "Vault name scope. Provide exactly one of vaultName or shareId.";
const SHARE_ID_SCOPE_DESCRIPTION = "Share ID scope. Provide exactly one of shareId or vaultName.";
const FILTER_TYPE_DESCRIPTION =
  "Filter items by type. Allowed values: note, login, alias, credit-card, identity, ssh-key, wifi, custom.";
const FILTER_STATE_DESCRIPTION =
  'Filter items by state. Allowed values: active, trashed. Use "active" to exclude trashed items.';
const SORT_BY_DESCRIPTION =
  "Sort items. Allowed values: alphabetic-asc, alphabetic-desc, created-asc, created-desc.";
const PAGE_SIZE_DESCRIPTION = "Number of items per page (1-250, default 100)";
const CURSOR_DESCRIPTION = "Pagination cursor from a previous response's nextCursor";
const SEARCH_QUERY_DESCRIPTION = "Search query string";
const SEARCH_FIELD_DESCRIPTION = "Field to search (currently title only)";
const SEARCH_MATCH_DESCRIPTION = "Match strategy for the query";
const SEARCH_CASE_SENSITIVE_DESCRIPTION = "Whether the search is case-sensitive";
const SEARCH_VAULT_SCOPE_DESCRIPTION = "Limit search to a specific vault by name";
const SEARCH_SHARE_SCOPE_DESCRIPTION = "Limit search to a specific share by ID";

export type ItemRef = {
  id: string;
  share_id: string | null;
  vault_id: string | null;
  type: string | null;
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

function toItemRef(rawItem: unknown, index: number): ItemRef {
  const item = asRecord(rawItem);
  if (!item) {
    // Preserve pagination/reference behavior even when one entry is malformed.
    const fallbackId = `item-${index + 1}`;
    return {
      id: fallbackId,
      share_id: null,
      vault_id: null,
      type: null,
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
  // Item list JSON is interpreted as snake_case-first (see ADR-002).
  const id = firstString(item, ["id", "item_id"]) ?? parsedUri.itemId ?? `item-${index + 1}`;
  const shareId =
    firstString(item, ["share_id"]) ??
    firstNestedString(item, ["share"], ["id", "share_id"]) ??
    parsedUri.shareId;
  const vaultId =
    firstString(item, ["vault_id"]) ?? firstNestedString(item, ["vault"], ["id", "vault_id"]);
  const title = firstNestedString(item, ["content"], ["title"]) ?? firstString(item, ["title"]);
  const type = extractItemType(item);

  const displayTitle = title ?? `[untitled:${shortId(id)}]`;
  const derivedUri = shareId ? `pass://${shareId}/${id}` : existingUri;

  return {
    id,
    share_id: shareId,
    vault_id: vaultId,
    type,
    title,
    display_title: displayTitle,
    state: firstString(item, ["state"]),
    create_time: firstString(item, ["create_time", "created_at"]),
    modify_time: firstString(item, ["modify_time", "updated_at"]),
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
    vaultName: z.string().max(255).optional().describe(VAULT_NAME_SCOPE_DESCRIPTION),
    shareId: z.string().max(100).optional().describe(SHARE_ID_SCOPE_DESCRIPTION),
    filterType: z.enum(ITEM_FILTER_TYPES).optional().describe(FILTER_TYPE_DESCRIPTION),
    filterState: z.enum(ITEM_FILTER_STATES).optional().describe(FILTER_STATE_DESCRIPTION),
    sortBy: z.enum(ITEM_SORT_OPTIONS).optional().describe(SORT_BY_DESCRIPTION),
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(MAX_ITEM_LIST_PAGE_SIZE)
      .optional()
      .describe(PAGE_SIZE_DESCRIPTION),
    cursor: z.string().max(20).optional().describe(CURSOR_DESCRIPTION),
    output: z.enum(["json", "human"]).default("json").describe("Output format"),
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
  uri: z.string().max(1024).optional().describe("Item URI (e.g. pass://<shareId>/<itemId>)"),
  shareId: z.string().max(100).optional().describe("Share ID containing the item"),
  vaultName: z.string().max(255).optional().describe("Vault name containing the item"),
  itemId: z.string().max(100).optional().describe("Item ID to view"),
  itemTitle: z.string().max(255).optional().describe("Item title to view"),
  field: z.string().max(100).optional().describe("Specific field to extract from the item"),
  output: z.enum(["json", "human"]).default("json").describe("Output format"),
});

export const itemTotpInputSchema = z.object({
  uri: z
    .string()
    .max(1024)
    .optional()
    .describe("Item URI (e.g. pass://<shareId>/<itemId>/<field>)"),
  shareId: z.string().max(100).optional().describe("Share ID containing the item"),
  vaultName: z.string().max(255).optional().describe("Vault name containing the item"),
  itemId: z.string().max(100).optional().describe("Item ID to generate TOTP for"),
  itemTitle: z.string().max(255).optional().describe("Item title to generate TOTP for"),
  field: z.string().max(100).optional().describe("Specific TOTP field to extract"),
  output: z.enum(["json", "human"]).default("json").describe("Output format"),
});

export const searchItemsInputSchema = z
  .object({
    query: z.string().min(1).max(255).describe(SEARCH_QUERY_DESCRIPTION),
    field: z.literal("title").default("title").describe(SEARCH_FIELD_DESCRIPTION),
    match: z
      .enum(["contains", "prefix", "exact"])
      .default("contains")
      .describe(SEARCH_MATCH_DESCRIPTION),
    caseSensitive: z.boolean().default(false).describe(SEARCH_CASE_SENSITIVE_DESCRIPTION),
    vaultName: z.string().max(255).optional().describe(SEARCH_VAULT_SCOPE_DESCRIPTION),
    shareId: z.string().max(100).optional().describe(SEARCH_SHARE_SCOPE_DESCRIPTION),
    filterType: z.enum(ITEM_FILTER_TYPES).optional().describe(FILTER_TYPE_DESCRIPTION),
    filterState: z.enum(ITEM_FILTER_STATES).optional().describe(FILTER_STATE_DESCRIPTION),
    sortBy: z.enum(ITEM_SORT_OPTIONS).optional().describe(SORT_BY_DESCRIPTION),
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(MAX_ITEM_LIST_PAGE_SIZE)
      .optional()
      .describe(PAGE_SIZE_DESCRIPTION),
    cursor: z.string().max(20).optional().describe(CURSOR_DESCRIPTION),
  })
  .refine((input) => !(input.vaultName && input.shareId), {
    message: "Provide only one of vaultName or shareId.",
  });

export const createLoginItemInputSchema = z.object({
  shareId: z.string().max(100).optional().describe("Share ID for the new item"),
  vaultName: z.string().max(255).optional().describe("Vault name for the new item"),
  title: z.string().max(255).describe("Title for the new login item"),
  username: z.string().max(255).optional().describe("Username for the login"),
  email: z.string().max(255).optional().describe("Email for the login"),
  password: z.string().max(1024).optional().describe("Password for the login"),
  url: z.string().max(1024).optional().describe("URL for the login"),
  generatePassword: z
    .string()
    .max(100)
    .optional()
    .describe('Set to "true" to auto-generate, or pass generator options'),
  output: z.enum(["json", "human"]).default("json").describe("Output format"),
  confirm: z.boolean().optional().describe("Must be true to execute the write operation"),
});

export const loginItemTemplateSchema = z
  .object({
    title: z.string().max(255).describe("Title of the login item"),
    urls: z.array(z.string().max(1024)).optional().describe("Optional list of URL strings"),
    username: z.string().max(255).nullable().optional().describe("Optional username"),
    email: z.string().max(255).nullable().optional().describe("Optional email"),
    password: z.string().max(1024).nullable().optional().describe("Optional password"),
  })
  .strict();

export const createLoginItemFromTemplateInputSchema = z.object({
  shareId: z.string().max(100).optional().describe("Share ID for the new item"),
  vaultName: z.string().max(255).optional().describe("Vault name for the new item"),
  template: loginItemTemplateSchema.describe("Login template payload"),
  output: z.enum(["json", "human"]).default("json").describe("Output format"),
  confirm: z.boolean().optional().describe("Must be true to execute the write operation"),
});

export const createNoteItemInputSchema = z.object({
  shareId: z.string().max(100).optional().describe("Share ID for the new item"),
  vaultName: z.string().max(255).optional().describe("Vault name for the new item"),
  title: z.string().max(255).describe("Title for the new note item"),
  note: z.string().max(10000).optional().describe("Optional note content"),
  confirm: z.boolean().optional().describe("Must be true to execute the write operation"),
});

export const createCreditCardItemInputSchema = z.object({
  shareId: z.string().max(100).optional().describe("Share ID for the new item"),
  vaultName: z.string().max(255).optional().describe("Vault name for the new item"),
  title: z.string().max(255).describe("Title for the new credit card item"),
  cardholderName: z.string().max(255).optional().describe("Cardholder name"),
  number: z.string().max(64).optional().describe("Card number"),
  cvv: z.string().max(16).optional().describe("CVV/CVC security code"),
  expirationDate: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Expected YYYY-MM")
    .optional()
    .describe("Expiration date (YYYY-MM)"),
  pin: z.string().max(64).optional().describe("Card PIN"),
  note: z.string().max(10000).optional().describe("Optional note content"),
  confirm: z.boolean().optional().describe("Must be true to execute the write operation"),
});

export const createWifiItemInputSchema = z.object({
  shareId: z.string().max(100).optional().describe("Share ID for the new item"),
  vaultName: z.string().max(255).optional().describe("Vault name for the new item"),
  title: z.string().max(255).describe("Title for the new WiFi item"),
  ssid: z.string().min(1).max(255).describe("Network SSID (required, non-empty)"),
  password: z
    .string()
    .max(2048)
    .optional()
    .describe("Network password (optional; empty string for open networks)"),
  security: z
    .enum(WIFI_SECURITY_OPTIONS)
    .optional()
    .describe("WiFi security type: wpa, wpa2, wpa3, wep, open, none"),
  note: z.string().max(10000).optional().describe("Optional note content"),
  confirm: z.boolean().optional().describe("Must be true to execute the write operation"),
});

const customTemplateFieldSchema = z
  .object({
    field_name: z.string().min(1).max(255).describe("Field display name"),
    field_type: z.string().min(1).max(100).describe("Field type (for example text, hidden, totp)"),
    value: z.string().max(10000).describe("Field value"),
  })
  .strict();

const customTemplateSectionSchema = z
  .object({
    section_name: z.string().min(1).max(255).describe("Section name"),
    fields: z.array(customTemplateFieldSchema).describe("Fields in this section"),
  })
  .strict();

export const customItemTemplateSchema = z
  .object({
    title: z.string().max(255).describe("Title of the custom item"),
    note: z.string().max(10000).nullable().optional().describe("Optional note"),
    sections: z.array(customTemplateSectionSchema).optional().describe("Optional custom sections"),
  })
  .strict();

export const createCustomItemInputSchema = z.object({
  shareId: z.string().max(100).optional().describe("Share ID for the new item"),
  vaultName: z.string().max(255).optional().describe("Vault name for the new item"),
  template: customItemTemplateSchema.describe("Custom item template payload"),
  confirm: z.boolean().optional().describe("Must be true to execute the write operation"),
});

export const identityItemTemplateSchema = z
  .object({
    title: z.string().max(255),
    note: z.string().max(255).nullable().optional(),
    full_name: z.string().max(255).nullable().optional(),
    email: z.string().max(320).nullable().optional(),
    phone_number: z.string().max(255).nullable().optional(),
    first_name: z.string().max(255).nullable().optional(),
    middle_name: z.string().max(255).nullable().optional(),
    last_name: z.string().max(255).nullable().optional(),
    birthdate: z.string().max(255).nullable().optional(),
    gender: z.string().max(255).nullable().optional(),
    organization: z.string().max(255).nullable().optional(),
    street_address: z.string().max(255).nullable().optional(),
    zip_or_postal_code: z.string().max(255).nullable().optional(),
    city: z.string().max(255).nullable().optional(),
    state_or_province: z.string().max(255).nullable().optional(),
    country_or_region: z.string().max(255).nullable().optional(),
    floor: z.string().max(255).nullable().optional(),
    county: z.string().max(255).nullable().optional(),
    social_security_number: z.string().max(255).nullable().optional(),
    passport_number: z.string().max(255).nullable().optional(),
    license_number: z.string().max(255).nullable().optional(),
    website: z.string().max(255).nullable().optional(),
    x_handle: z.string().max(255).nullable().optional(),
    second_phone_number: z.string().max(255).nullable().optional(),
    linkedin: z.string().max(255).nullable().optional(),
    reddit: z.string().max(255).nullable().optional(),
    facebook: z.string().max(255).nullable().optional(),
    yahoo: z.string().max(255).nullable().optional(),
    instagram: z.string().max(255).nullable().optional(),
    company: z.string().max(255).nullable().optional(),
    job_title: z.string().max(255).nullable().optional(),
    personal_website: z.string().max(255).nullable().optional(),
    work_phone_number: z.string().max(255).nullable().optional(),
    work_email: z.string().max(320).nullable().optional(),
  })
  .strict();

export const createIdentityItemInputSchema = z.object({
  shareId: z.string().max(100).optional().describe("Share ID for the new item"),
  vaultName: z.string().max(255).optional().describe("Vault name for the new item"),
  template: identityItemTemplateSchema.describe("Identity item template payload"),
  confirm: z.boolean().optional().describe("Must be true to execute the write operation"),
});

export const moveItemInputSchema = z
  .object({
    fromShareId: z.string().max(100).optional().describe("Source share ID"),
    fromVaultName: z.string().max(255).optional().describe("Source vault name"),
    toShareId: z.string().max(100).optional().describe("Destination share ID"),
    toVaultName: z.string().max(255).optional().describe("Destination vault name"),
    itemId: z.string().max(100).optional().describe("Item ID to move"),
    itemTitle: z.string().max(255).optional().describe("Item title to move"),
    confirm: z.boolean().optional().describe("Must be true to execute the write operation"),
  })
  .refine((input) => Boolean(input.fromShareId) !== Boolean(input.fromVaultName), {
    message: "Provide exactly one of fromShareId or fromVaultName.",
  })
  .refine((input) => Boolean(input.toShareId) !== Boolean(input.toVaultName), {
    message: "Provide exactly one of toShareId or toVaultName.",
  })
  .refine((input) => Boolean(input.itemId) !== Boolean(input.itemTitle), {
    message: "Provide exactly one of itemId or itemTitle.",
  });

export const updateItemInputSchema = z.object({
  shareId: z.string().max(100).optional().describe("Share ID containing the item"),
  vaultName: z.string().max(255).optional().describe("Vault name containing the item"),
  itemId: z.string().max(100).optional().describe("Item ID to update"),
  itemTitle: z.string().max(255).optional().describe("Item title to update"),
  fields: z.array(z.string().max(1024)).min(1).describe("Fields to update (key=value pairs)"),
  confirm: z.boolean().optional().describe("Must be true to execute the write operation"),
});

export const trashItemInputSchema = z
  .object({
    shareId: z.string().max(100).optional().describe("Share ID containing the item"),
    vaultName: z.string().max(255).optional().describe("Vault name containing the item"),
    itemId: z.string().max(100).optional().describe("Item ID to trash"),
    itemTitle: z.string().max(255).optional().describe("Item title to trash"),
    confirm: z.boolean().optional().describe("Must be true to execute the write operation"),
  })
  .refine((input) => !(input.shareId && input.vaultName), {
    message: "Provide only one of shareId or vaultName.",
  })
  .refine((input) => Boolean(input.itemId) !== Boolean(input.itemTitle), {
    message: "Provide exactly one of itemId or itemTitle.",
  });

export const untrashItemInputSchema = z
  .object({
    shareId: z.string().max(100).optional().describe("Share ID containing the item"),
    vaultName: z.string().max(255).optional().describe("Vault name containing the item"),
    itemId: z.string().max(100).optional().describe("Item ID to restore"),
    itemTitle: z.string().max(255).optional().describe("Item title to restore"),
    confirm: z.boolean().optional().describe("Must be true to execute the write operation"),
  })
  .refine((input) => !(input.shareId && input.vaultName), {
    message: "Provide only one of shareId or vaultName.",
  })
  .refine((input) => Boolean(input.itemId) !== Boolean(input.itemTitle), {
    message: "Provide exactly one of itemId or itemTitle.",
  });

export const deleteItemInputSchema = z.object({
  shareId: z.string().max(100).describe("Share ID containing the item to delete"),
  itemId: z.string().max(100).describe("Item ID to delete"),
  confirm: z.boolean().optional().describe("Must be true to execute the write operation"),
});

const SHARE_ROLE_OPTIONS = ["viewer", "editor", "manager"] as const;

export const shareItemInputSchema = z.object({
  shareId: z.string().max(100).describe("Share ID containing the item"),
  itemId: z.string().max(100).describe("Item ID to share"),
  email: z.string().email().max(320).describe("Email of the user to invite"),
  role: z.enum(SHARE_ROLE_OPTIONS).optional().describe("Role for the invited user"),
  confirm: z.boolean().optional().describe("Must be true to execute the write operation"),
});

export const createItemAliasInputSchema = z
  .object({
    shareId: z.string().max(100).optional().describe("Share ID where alias item will be created"),
    vaultName: z
      .string()
      .max(255)
      .optional()
      .describe("Vault name where alias item will be created"),
    prefix: z.string().min(1).max(255).describe("Alias prefix"),
    output: z.enum(["json", "human"]).default("json").describe("Output format"),
    confirm: z.boolean().optional().describe("Must be true to execute the write operation"),
  })
  .refine((input) => !(input.shareId && input.vaultName), {
    message: "Provide only one of shareId or vaultName.",
  });

export type ListItemsInput = z.infer<typeof listItemsInputSchema>;
export type ViewItemInput = z.infer<typeof viewItemInputSchema>;
export type ItemTotpInput = z.infer<typeof itemTotpInputSchema>;
export type SearchItemsInput = z.infer<typeof searchItemsInputSchema>;
export type CreateLoginItemInput = z.infer<typeof createLoginItemInputSchema>;
export type CreateLoginItemFromTemplateInput = z.infer<
  typeof createLoginItemFromTemplateInputSchema
>;
export type CreateNoteItemInput = z.infer<typeof createNoteItemInputSchema>;
export type CreateCreditCardItemInput = z.infer<typeof createCreditCardItemInputSchema>;
export type CreateWifiItemInput = z.infer<typeof createWifiItemInputSchema>;
export type CreateCustomItemInput = z.infer<typeof createCustomItemInputSchema>;
export type CreateIdentityItemInput = z.infer<typeof createIdentityItemInputSchema>;
export type MoveItemInput = z.infer<typeof moveItemInputSchema>;
export type UpdateItemInput = z.infer<typeof updateItemInputSchema>;
export type TrashItemInput = z.infer<typeof trashItemInputSchema>;
export type UntrashItemInput = z.infer<typeof untrashItemInputSchema>;
export type DeleteItemInput = z.infer<typeof deleteItemInputSchema>;
export type ShareItemInput = z.infer<typeof shareItemInputSchema>;
export type CreateItemAliasInput = z.infer<typeof createItemAliasInputSchema>;

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
  if (filterType) args.push("--filter-type", filterType);
  if (filterState) args.push("--filter-state", filterState);
  if (sortBy) args.push("--sort-by", sortBy);
  args.push("--output", output);
  if (vaultName) args.push("--", vaultName);

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

function matchesQuery({
  query,
  candidate,
  match,
  caseSensitive,
}: {
  query: string;
  candidate: string;
  match: "contains" | "prefix" | "exact";
  caseSensitive: boolean;
}): boolean {
  const left = caseSensitive ? candidate : candidate.toLowerCase();
  const right = caseSensitive ? query : query.toLowerCase();

  if (match === "exact") return left === right;
  if (match === "prefix") return left.startsWith(right);
  return left.includes(right);
}

export async function searchItemsHandler(
  passCli: PassCliRunner,
  {
    query,
    field,
    match,
    caseSensitive,
    vaultName,
    shareId,
    filterType,
    filterState,
    sortBy,
    pageSize,
    cursor,
  }: SearchItemsInput,
) {
  if (vaultName && shareId) {
    throw new Error("Provide only one of vaultName or shareId.");
  }

  const args = ["item", "list"];
  if (shareId) args.push("--share-id", shareId);
  if (filterType) args.push("--filter-type", filterType);
  if (filterState) args.push("--filter-state", filterState);
  if (sortBy) args.push("--sort-by", sortBy);
  args.push("--output", "json");
  if (vaultName) args.push("--", vaultName);

  const { stdout } = await passCli(args);

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
  const filtered = refs.filter((item) =>
    item.title
      ? matchesQuery({
          query,
          candidate: item.title,
          match,
          caseSensitive,
        })
      : false,
  );

  const start = parseCursor(cursor);
  const size = pageSize ?? DEFAULT_ITEM_LIST_PAGE_SIZE;
  const end = start + size;
  const items = filtered.slice(start, end);
  const nextCursor = end < filtered.length ? String(end) : null;

  const structuredContent = {
    items,
    pageSize: size,
    cursor: String(start),
    returned: items.length,
    total: filtered.length,
    nextCursor,
    queryMeta: {
      field,
      match,
      caseSensitive,
    },
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
    args.push("--output", output, "--", uri);
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

export async function itemTotpHandler(passCli: PassCliRunner, input: ItemTotpInput) {
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

  const args: string[] = ["item", "totp"];

  if (usingUri) {
    args.push("--output", output, "--", uri);
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

export async function createLoginItemFromTemplateHandler(
  passCli: PassCliRunner,
  input: CreateLoginItemFromTemplateInput,
) {
  requireWriteGate(input.confirm);
  if (input.shareId && input.vaultName)
    throw new Error("Provide only one of shareId or vaultName.");

  const args: string[] = ["item", "create", "login", "--from-template", "-"];
  if (input.shareId) args.push("--share-id", input.shareId);
  else if (input.vaultName) args.push("--vault-name", input.vaultName);

  args.push("--output", input.output);

  const { stdout, stderr } = await passCli(args, JSON.stringify(input.template));
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(asJsonTextOrRaw(out));
}

export async function createNoteItemHandler(passCli: PassCliRunner, input: CreateNoteItemInput) {
  requireWriteGate(input.confirm);
  if (input.shareId && input.vaultName)
    throw new Error("Provide only one of shareId or vaultName.");

  const args: string[] = ["item", "create", "note"];
  if (input.shareId) args.push("--share-id", input.shareId);
  else if (input.vaultName) args.push("--vault-name", input.vaultName);

  args.push("--title", input.title);
  if (input.note !== undefined) args.push("--note", input.note);

  const { stdout, stderr } = await passCli(args);
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(asJsonTextOrRaw(out));
}

export async function createCreditCardItemHandler(
  passCli: PassCliRunner,
  input: CreateCreditCardItemInput,
) {
  requireWriteGate(input.confirm);
  if (input.shareId && input.vaultName)
    throw new Error("Provide only one of shareId or vaultName.");

  const args: string[] = ["item", "create", "credit-card"];
  if (input.shareId) args.push("--share-id", input.shareId);
  else if (input.vaultName) args.push("--vault-name", input.vaultName);

  args.push("--title", input.title);
  if (input.cardholderName !== undefined) args.push("--cardholder-name", input.cardholderName);
  if (input.number !== undefined) args.push("--number", input.number);
  if (input.cvv !== undefined) args.push("--cvv", input.cvv);
  if (input.expirationDate !== undefined) args.push("--expiration-date", input.expirationDate);
  if (input.pin !== undefined) args.push("--pin", input.pin);
  if (input.note !== undefined) args.push("--note", input.note);

  const { stdout, stderr } = await passCli(args);
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(asJsonTextOrRaw(out));
}

export async function createWifiItemHandler(passCli: PassCliRunner, input: CreateWifiItemInput) {
  requireWriteGate(input.confirm);
  if (input.shareId && input.vaultName)
    throw new Error("Provide only one of shareId or vaultName.");

  const args: string[] = ["item", "create", "wifi"];
  if (input.shareId) args.push("--share-id", input.shareId);
  else if (input.vaultName) args.push("--vault-name", input.vaultName);

  args.push("--title", input.title, "--ssid", input.ssid);
  if (input.password !== undefined) args.push("--password", input.password);
  if (input.security !== undefined) args.push("--security", input.security);
  if (input.note !== undefined) args.push("--note", input.note);

  const { stdout, stderr } = await passCli(args);
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(asJsonTextOrRaw(out));
}

export async function createCustomItemHandler(
  passCli: PassCliRunner,
  input: CreateCustomItemInput,
) {
  requireWriteGate(input.confirm);
  if (input.shareId && input.vaultName)
    throw new Error("Provide only one of shareId or vaultName.");

  const args: string[] = ["item", "create", "custom", "--from-template", "-"];
  if (input.shareId) args.push("--share-id", input.shareId);
  else if (input.vaultName) args.push("--vault-name", input.vaultName);

  const { stdout, stderr } = await passCli(args, JSON.stringify(input.template));
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(asJsonTextOrRaw(out));
}

export async function createIdentityItemHandler(
  passCli: PassCliRunner,
  input: CreateIdentityItemInput,
) {
  requireWriteGate(input.confirm);
  if (input.shareId && input.vaultName)
    throw new Error("Provide only one of shareId or vaultName.");

  const args: string[] = ["item", "create", "identity", "--from-template", "-"];
  if (input.shareId) args.push("--share-id", input.shareId);
  else if (input.vaultName) args.push("--vault-name", input.vaultName);

  const { stdout, stderr } = await passCli(args, JSON.stringify(input.template));
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(asJsonTextOrRaw(out));
}

export async function moveItemHandler(passCli: PassCliRunner, input: MoveItemInput) {
  requireWriteGate(input.confirm);

  const hasFromShareId = Boolean(input.fromShareId);
  const hasFromVaultName = Boolean(input.fromVaultName);
  if (hasFromShareId === hasFromVaultName) {
    throw new Error("Provide exactly one of fromShareId or fromVaultName.");
  }

  const hasToShareId = Boolean(input.toShareId);
  const hasToVaultName = Boolean(input.toVaultName);
  if (hasToShareId === hasToVaultName) {
    throw new Error("Provide exactly one of toShareId or toVaultName.");
  }

  const hasItemId = Boolean(input.itemId);
  const hasItemTitle = Boolean(input.itemTitle);
  if (hasItemId === hasItemTitle) {
    throw new Error("Provide exactly one of itemId or itemTitle.");
  }

  const args = ["item", "move"];
  if (input.fromShareId) args.push("--from-share-id", input.fromShareId);
  else args.push("--from-vault-name", input.fromVaultName!);

  if (input.itemId) args.push("--item-id", input.itemId);
  else args.push("--item-title", input.itemTitle!);

  if (input.toShareId) args.push("--to-share-id", input.toShareId);
  else args.push("--to-vault-name", input.toVaultName!);

  const { stdout, stderr } = await passCli(args);
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(out || "OK");
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

export async function trashItemHandler(
  passCli: PassCliRunner,
  { shareId, vaultName, itemId, itemTitle, confirm }: TrashItemInput,
) {
  requireWriteGate(confirm);
  if (shareId && vaultName) throw new Error("Provide only one of shareId or vaultName.");
  if (itemId && itemTitle) throw new Error("Provide only one of itemId or itemTitle.");
  if (!itemId && !itemTitle) throw new Error("Provide itemId or itemTitle.");

  const args: string[] = ["item", "trash"];
  if (shareId) args.push("--share-id", shareId);
  else if (vaultName) args.push("--vault-name", vaultName);

  if (itemId) args.push("--item-id", itemId);
  else args.push("--item-title", itemTitle!);

  const { stdout, stderr } = await passCli(args);
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(out || "OK");
}

export async function untrashItemHandler(
  passCli: PassCliRunner,
  { shareId, vaultName, itemId, itemTitle, confirm }: UntrashItemInput,
) {
  requireWriteGate(confirm);
  if (shareId && vaultName) throw new Error("Provide only one of shareId or vaultName.");
  if (itemId && itemTitle) throw new Error("Provide only one of itemId or itemTitle.");
  if (!itemId && !itemTitle) throw new Error("Provide itemId or itemTitle.");

  const args: string[] = ["item", "untrash"];
  if (shareId) args.push("--share-id", shareId);
  else if (vaultName) args.push("--vault-name", vaultName);

  if (itemId) args.push("--item-id", itemId);
  else args.push("--item-title", itemTitle!);

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

export async function shareItemHandler(
  passCli: PassCliRunner,
  { shareId, itemId, email, role, confirm }: ShareItemInput,
) {
  requireWriteGate(confirm);
  const args = ["item", "share", "--share-id", shareId, "--item-id", itemId, email];
  if (role) args.push("--role", role);
  const { stdout, stderr } = await passCli(args);
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(out || "OK");
}

export async function createItemAliasHandler(
  passCli: PassCliRunner,
  { shareId, vaultName, prefix, output, confirm }: CreateItemAliasInput,
) {
  requireWriteGate(confirm);
  if (shareId && vaultName) throw new Error("Provide only one of shareId or vaultName.");

  const args = ["item", "alias", "create"];
  if (shareId) args.push("--share-id", shareId);
  else if (vaultName) args.push("--vault-name", vaultName);
  args.push("--prefix", prefix, "--output", output);

  const { stdout, stderr } = await passCli(args);
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(asJsonTextOrRaw(out));
}
