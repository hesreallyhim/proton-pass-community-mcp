import { z } from "zod";

import { asJsonTextOrRaw, asTextContent, asWriteResult } from "../pass-cli/output.js";
import type { PassCliRunner } from "../pass-cli/runner.js";
import { asRecord } from "./shared/item-utils.js";
import { confirmInput } from "./shared/schema-fragments.js";
import { appendScopeArgs, scopeRefinement } from "./shared/scope.js";
import { requireWriteGate } from "./shared/write-gate.js";

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
    confirm: confirmInput,
  })
  .refine(scopeRefinement.check, { message: scopeRefinement.message });

export const settingsUnsetDefaultVaultInputSchema = z.object({
  confirm: confirmInput,
});

export type SettingsSetDefaultVaultInput = z.infer<typeof settingsSetDefaultVaultInputSchema>;
export type SettingsUnsetDefaultVaultInput = z.infer<typeof settingsUnsetDefaultVaultInputSchema>;

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
  const args = ["settings", "set", "default-vault"];
  appendScopeArgs(args, { shareId, vaultName });

  const { stdout, stderr } = await passCli(args);
  return asWriteResult(stdout, stderr);
}

export async function settingsUnsetDefaultVaultHandler(
  passCli: PassCliRunner,
  { confirm }: SettingsUnsetDefaultVaultInput,
) {
  requireWriteGate(confirm);
  const { stdout, stderr } = await passCli(["settings", "unset", "default-vault"]);
  return asWriteResult(stdout, stderr);
}
