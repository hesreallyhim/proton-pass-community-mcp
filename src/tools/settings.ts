import { z } from "zod";

import { asJsonTextOrRaw, asTextContent, joinStdoutStderr } from "../pass-cli/output.js";
import type { PassCliRunner } from "../pass-cli/runner.js";
import { asRecord } from "./item-utils.js";
import { requireWriteGate } from "./write-gate.js";

type ParsedSettings = Record<string, string | null>;

function normalizeSettingKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeSettingValue(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower === "none" || lower === "(none)" || lower === "null" || lower === "unset") {
    return null;
  }
  return trimmed;
}

function parseSettingsFromText(text: string): ParsedSettings {
  const settings: ParsedSettings = {};
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(/^\s*[-*]?\s*([A-Za-z0-9 _-]+):\s*(.+)\s*$/);
    if (!match) continue;
    const key = normalizeSettingKey(match[1] ?? "");
    if (!key) continue;
    settings[key] = normalizeSettingValue(match[2] ?? "");
  }

  return settings;
}

export const settingsSetDefaultVaultInputSchema = z
  .object({
    shareId: z.string().max(100).optional().describe("Share ID of the vault to set as default"),
    vaultName: z.string().max(255).optional().describe("Vault name to set as default"),
    confirm: z.boolean().optional().describe("Must be true to execute the write operation"),
  })
  .refine(
    (input) => {
      const hasShareId = Boolean(input.shareId);
      const hasVaultName = Boolean(input.vaultName);
      return hasShareId !== hasVaultName;
    },
    {
      message: "Provide exactly one of shareId or vaultName.",
    },
  );

export const settingsSetDefaultFormatInputSchema = z.object({
  format: z.enum(["human", "json"]).describe("Default output format"),
  confirm: z.boolean().optional().describe("Must be true to execute the write operation"),
});

export const settingsUnsetDefaultVaultInputSchema = z.object({
  confirm: z.boolean().optional().describe("Must be true to execute the write operation"),
});

export const settingsUnsetDefaultFormatInputSchema = z.object({
  confirm: z.boolean().optional().describe("Must be true to execute the write operation"),
});

export type SettingsSetDefaultVaultInput = z.infer<typeof settingsSetDefaultVaultInputSchema>;
export type SettingsSetDefaultFormatInput = z.infer<typeof settingsSetDefaultFormatInputSchema>;
export type SettingsUnsetDefaultVaultInput = z.infer<typeof settingsUnsetDefaultVaultInputSchema>;
export type SettingsUnsetDefaultFormatInput = z.infer<typeof settingsUnsetDefaultFormatInputSchema>;

export async function viewSettingsHandler(passCli: PassCliRunner) {
  const { stdout } = await passCli(["settings", "view"]);
  const trimmed = stdout.trim();
  if (!trimmed) return asTextContent("");

  try {
    const parsedJson = JSON.parse(trimmed);
    const parsedRecord = asRecord(parsedJson);
    if (parsedRecord) {
      const structuredContent = { settings: parsedRecord };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
        structuredContent,
      };
    }

    return asTextContent(asJsonTextOrRaw(trimmed));
  } catch {
    const settings = parseSettingsFromText(trimmed);
    const structuredContent = {
      settings,
      rawText: trimmed,
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
      structuredContent,
    };
  }
}

export async function settingsSetDefaultVaultHandler(
  passCli: PassCliRunner,
  { shareId, vaultName, confirm }: SettingsSetDefaultVaultInput,
) {
  requireWriteGate(confirm);
  if (!!shareId === !!vaultName) {
    throw new Error("Provide exactly one of shareId or vaultName.");
  }

  const args = ["settings", "set", "default-vault"];
  if (shareId) args.push("--share-id", shareId);
  else args.push("--vault-name", vaultName!);

  const { stdout, stderr } = await passCli(args);
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(out || "OK");
}

export async function settingsSetDefaultFormatHandler(
  passCli: PassCliRunner,
  { format, confirm }: SettingsSetDefaultFormatInput,
) {
  requireWriteGate(confirm);
  const { stdout, stderr } = await passCli(["settings", "set", "default-format", format]);
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(out || "OK");
}

export async function settingsUnsetDefaultVaultHandler(
  passCli: PassCliRunner,
  { confirm }: SettingsUnsetDefaultVaultInput,
) {
  requireWriteGate(confirm);
  const { stdout, stderr } = await passCli(["settings", "unset", "default-vault"]);
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(out || "OK");
}

export async function settingsUnsetDefaultFormatHandler(
  passCli: PassCliRunner,
  { confirm }: SettingsUnsetDefaultFormatInput,
) {
  requireWriteGate(confirm);
  const { stdout, stderr } = await passCli(["settings", "unset", "default-format"]);
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(out || "OK");
}
