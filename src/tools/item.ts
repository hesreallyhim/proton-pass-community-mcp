import { z } from "zod";

import { asJsonTextOrRaw, asTextContent, joinStdoutStderr } from "../pass-cli/output.js";
import type { PassCliRunner } from "../pass-cli/runner.js";
import { requireWriteGate } from "./write-gate.js";

const DEFAULT_ITEM_LIST_PAGE_SIZE = 100;
const MAX_ITEM_LIST_PAGE_SIZE = 250;

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

export const passItemListInputSchema = z
  .object({
    vaultName: z.string().optional(),
    shareId: z.string().optional(),
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

export const passItemViewInputSchema = z.object({
  uri: z.string().optional(),
  shareId: z.string().optional(),
  vaultName: z.string().optional(),
  itemId: z.string().optional(),
  itemTitle: z.string().optional(),
  field: z.string().optional(),
  output: z.enum(["json", "human"]).default("json"),
});

export const passItemCreateLoginInputSchema = z.object({
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

export const passItemCreateFromTemplateInputSchema = z.object({
  itemType: z.string(),
  shareId: z.string().optional(),
  vaultName: z.string().optional(),
  templateJson: z.string(),
  output: z.enum(["json", "human"]).default("json"),
  confirm: z.boolean().optional(),
});

export const passItemUpdateInputSchema = z.object({
  shareId: z.string().optional(),
  vaultName: z.string().optional(),
  itemId: z.string().optional(),
  itemTitle: z.string().optional(),
  fields: z.array(z.string()).min(1),
  confirm: z.boolean().optional(),
});

export const passItemDeleteInputSchema = z.object({
  shareId: z.string(),
  itemId: z.string(),
  confirm: z.boolean().optional(),
});

export type PassItemListInput = z.infer<typeof passItemListInputSchema>;
export type PassItemViewInput = z.infer<typeof passItemViewInputSchema>;
export type PassItemCreateLoginInput = z.infer<typeof passItemCreateLoginInputSchema>;
export type PassItemCreateFromTemplateInput = z.infer<typeof passItemCreateFromTemplateInputSchema>;
export type PassItemUpdateInput = z.infer<typeof passItemUpdateInputSchema>;
export type PassItemDeleteInput = z.infer<typeof passItemDeleteInputSchema>;

export async function passItemListHandler(
  passCli: PassCliRunner,
  { vaultName, shareId, pageSize, cursor, output }: PassItemListInput,
) {
  if (!vaultName && !shareId) {
    throw new Error("Provide exactly one of vaultName or shareId.");
  }
  if (vaultName && shareId) throw new Error("Provide only one of vaultName or shareId.");
  if (output !== "json" && (pageSize !== undefined || cursor !== undefined)) {
    throw new Error('Pagination is supported only with {"output":"json"}.');
  }

  const args = ["item", "list", "--output", output];
  if (shareId) args.splice(2, 0, "--share-id", shareId);
  else if (vaultName) args.splice(2, 0, vaultName);

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

  if (!Array.isArray(parsed)) {
    return asTextContent(asJsonTextOrRaw(stdout));
  }

  const start = parseCursor(cursor);
  const size = pageSize ?? DEFAULT_ITEM_LIST_PAGE_SIZE;
  const end = start + size;
  const items = parsed.slice(start, end);
  const nextCursor = end < parsed.length ? String(end) : undefined;

  const structuredContent = {
    items,
    pageSize: size,
    cursor: String(start),
    returned: items.length,
    total: parsed.length,
    nextCursor,
  };

  return {
    content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
  };
}

export async function passItemViewHandler(passCli: PassCliRunner, input: PassItemViewInput) {
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

export async function passItemCreateLoginHandler(
  passCli: PassCliRunner,
  input: PassItemCreateLoginInput,
) {
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

export async function passItemCreateFromTemplateHandler(
  passCli: PassCliRunner,
  input: PassItemCreateFromTemplateInput,
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

export async function passItemUpdateHandler(
  passCli: PassCliRunner,
  { shareId, vaultName, itemId, itemTitle, fields, confirm }: PassItemUpdateInput,
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

export async function passItemDeleteHandler(
  passCli: PassCliRunner,
  { shareId, itemId, confirm }: PassItemDeleteInput,
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
