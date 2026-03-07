import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { asRecord } from "../tools/shared/item-utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = join(
  __dirname,
  "..",
  "..",
  "docs",
  "testing",
  "item-create-templates.snapshot.json",
);

type ItemCreateTemplatesSnapshot = {
  captured_at: string;
  captured_by: string;
  pass_cli_version: string;
  templates: Record<string, unknown>;
};

let snapshotCache: ItemCreateTemplatesSnapshot | null = null;

function loadSnapshot(): ItemCreateTemplatesSnapshot {
  if (snapshotCache) return snapshotCache;

  const raw = readFileSync(SNAPSHOT_PATH, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const rec = asRecord(parsed);
  if (!rec) throw new Error("Invalid template snapshot shape: expected object.");

  const templates = asRecord(rec.templates);
  if (!templates) throw new Error("Invalid template snapshot shape: missing templates object.");

  snapshotCache = {
    captured_at: String(rec.captured_at ?? ""),
    captured_by: String(rec.captured_by ?? ""),
    pass_cli_version: String(rec.pass_cli_version ?? ""),
    templates,
  };
  return snapshotCache;
}

export function getItemCreateTemplateSnapshot(): ItemCreateTemplatesSnapshot {
  return loadSnapshot();
}

export function listItemCreateTemplateTypes(): string[] {
  const snapshot = loadSnapshot();
  return Object.keys(snapshot.templates).sort();
}

export function getItemCreateTemplateByType(type: string): unknown {
  const snapshot = loadSnapshot();
  return snapshot.templates[type];
}
