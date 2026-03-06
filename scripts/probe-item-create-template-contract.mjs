#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const snapshotPath = resolve(projectRoot, "docs/testing/item-create-templates.snapshot.json");
const reportPath = resolve(projectRoot, "docs/testing/item-create-template-probe.report.json");
const passDev = resolve(projectRoot, "scripts/pass-dev.sh");

const args = process.argv.slice(2);
const cleanupEnabled = args.includes("--cleanup");
const mode = args.includes("--run") || args.length === 0 ? "--run" : "invalid";
const delayArg = args.find((arg) => arg.startsWith("--delay-ms="));
const delayMs = delayArg ? Number.parseInt(delayArg.slice("--delay-ms=".length), 10) : 0;

if (mode !== "--run" || Number.isNaN(delayMs) || delayMs < 0) {
  process.stderr.write(
    "Usage: node scripts/probe-item-create-template-contract.mjs --run [--cleanup] [--delay-ms=<non-negative-int>]\n",
  );
  process.exit(2);
}

function runPassDev(args, stdin) {
  const result = spawnSync(passDev, args, {
    encoding: "utf8",
    input: stdin,
  });
  return {
    code: result.status ?? 1,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
  };
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function firstVaultShareId() {
  const out = runPassDev(["vault", "list", "--output", "json"]);
  if (out.code !== 0) {
    throw new Error(`Could not list vaults:\n${out.stderr || out.stdout}`);
  }
  const parsed = JSON.parse(out.stdout);
  const vaults = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.vaults)
      ? parsed.vaults
      : [];
  for (const v of vaults) {
    const shareId = v?.share_id ?? v?.shareId;
    if (typeof shareId === "string" && shareId) return shareId;
  }
  throw new Error("No share_id found from vault list output.");
}

function passCliVersion() {
  const out = runPassDev(["--version"]);
  if (out.code !== 0) return "unknown";
  return out.stdout || "unknown";
}

function createVariants(template) {
  const variants = [];
  const base = deepClone(template);
  variants.push({ name: "baseline", payload: base });

  if (Object.prototype.hasOwnProperty.call(base, "title")) {
    const omitTitle = deepClone(base);
    delete omitTitle.title;
    variants.push({ name: "omit_title", payload: omitTitle });

    const nullTitle = deepClone(base);
    nullTitle.title = null;
    variants.push({ name: "title_null", payload: nullTitle });

    const emptyTitle = deepClone(base);
    emptyTitle.title = "";
    variants.push({ name: "title_empty", payload: emptyTitle });
  }

  const removedNulls = deepClone(base);
  for (const [k, v] of Object.entries(removedNulls)) {
    if (v === null) delete removedNulls[k];
  }
  variants.push({ name: "omit_all_null_fields", payload: removedNulls });

  const nullifyStrings = deepClone(base);
  for (const [k, v] of Object.entries(nullifyStrings)) {
    if (k === "title") continue;
    if (typeof v === "string") nullifyStrings[k] = null;
  }
  variants.push({ name: "nullify_string_fields", payload: nullifyStrings });

  return variants;
}

function maybeDeleteCreated(shareId, createStdout) {
  const itemId = (createStdout || "").split(/\s+/)[0];
  if (!itemId) return { deleted: false, itemId: null };
  const del = runPassDev(["item", "delete", "--share-id", shareId, "--item-id", itemId]);
  return { deleted: del.code === 0, itemId };
}

const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
const templates = snapshot?.templates ?? {};
const templateTypes = Object.keys(templates).sort();

if (templateTypes.length === 0) {
  throw new Error("Template snapshot has no template types.");
}

const shareId = firstVaultShareId();
const results = {};

for (const type of templateTypes) {
  const template = templates[type];
  const variants = createVariants(template);
  const cases = [];

  for (const variant of variants) {
    const createArgs = ["item", "create", type, "--share-id", shareId, "--from-template", "-"];
    const create = runPassDev(createArgs, JSON.stringify(variant.payload));
    const cleanup =
      cleanupEnabled && create.code === 0
        ? maybeDeleteCreated(shareId, create.stdout)
        : { deleted: false, itemId: null };

    cases.push({
      variant: variant.name,
      exit_code: create.code,
      stdout: create.stdout,
      stderr: create.stderr,
      cleanup_enabled: cleanupEnabled,
      cleanup,
    });

    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }

  results[type] = cases;
}

const report = {
  generated_at: new Date().toISOString(),
  pass_cli_version: passCliVersion(),
  share_id: shareId,
  source_snapshot: "docs/testing/item-create-templates.snapshot.json",
  delay_ms: delayMs,
  results,
};

writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
process.stdout.write(`Wrote probe report: ${reportPath}\n`);
