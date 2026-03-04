import { asJsonTextOrRaw, asTextContent } from "../pass-cli/output.js";
import type { PassCliRunner } from "../pass-cli/runner.js";
import { asRecord } from "./item-utils.js";

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
