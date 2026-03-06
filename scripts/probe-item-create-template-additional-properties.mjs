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
const reportPath = resolve(
  projectRoot,
  "docs/testing/item-create-template-additional-properties.report.json",
);
const passDev = resolve(projectRoot, "scripts/pass-dev.sh");

const args = process.argv.slice(2);
const cleanupEnabled = args.includes("--cleanup");
const mode = args.includes("--run") || args.length === 0 ? "--run" : "invalid";
const delayArg = args.find((arg) => arg.startsWith("--delay-ms="));
const delayMs = delayArg ? Number.parseInt(delayArg.slice("--delay-ms=".length), 10) : 0;

if (mode !== "--run" || Number.isNaN(delayMs) || delayMs < 0) {
  process.stderr.write(
    "Usage: node scripts/probe-item-create-template-additional-properties.mjs --run [--cleanup] [--delay-ms=<non-negative-int>]\n",
  );
  process.exit(2);
}

function runPassDev(argv, stdin) {
  const result = spawnSync(passDev, argv, {
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

function maybeDeleteCreated(shareId, createStdout) {
  const itemId = (createStdout || "").split(/\s+/)[0];
  if (!itemId) return { deleted: false, itemId: null };
  const del = runPassDev(["item", "delete", "--share-id", shareId, "--item-id", itemId]);
  return { deleted: del.code === 0, itemId };
}

function classifyError(stderr) {
  if (!stderr) return "none";
  if (stderr.includes("Error parsing")) return "parser";
  if (stderr.includes("Invalid")) return "validation";
  if (stderr.includes("missing field")) return "parser";
  return "runtime_or_unknown";
}

function createReadyTemplate(type, template) {
  const base = deepClone(template);
  if (type === "wifi") {
    // Upstream wifi template defaults to empty ssid, which fails creation validation.
    // Give it a valid non-empty baseline so unknown-key tests isolate parser behavior.
    if (typeof base.ssid !== "string" || base.ssid.length === 0) {
      base.ssid = "probe-ssid";
    }
  }
  return base;
}

function buildVariants(type, baseTemplate) {
  const variants = [];
  variants.push({ name: "control_valid_base", payload: deepClone(baseTemplate) });

  const topLevelString = deepClone(baseTemplate);
  topLevelString.__probe_extra = "extra";
  variants.push({ name: "extra_top_level_string", payload: topLevelString });

  const topLevelNumber = deepClone(baseTemplate);
  topLevelNumber.__probe_extra_num = 42;
  variants.push({ name: "extra_top_level_number", payload: topLevelNumber });

  const topLevelObject = deepClone(baseTemplate);
  topLevelObject.__probe_extra_obj = { nested: true };
  variants.push({ name: "extra_top_level_object", payload: topLevelObject });

  const topLevelArray = deepClone(baseTemplate);
  topLevelArray.__probe_extra_arr = [1, "two", { three: 3 }];
  variants.push({ name: "extra_top_level_array", payload: topLevelArray });

  if (type === "custom") {
    const sectionExtra = deepClone(baseTemplate);
    if (Array.isArray(sectionExtra.sections) && sectionExtra.sections.length > 0) {
      sectionExtra.sections[0].__probe_section_extra = "section-extra";
      variants.push({ name: "custom_extra_section_property", payload: sectionExtra });
    }

    const fieldExtra = deepClone(baseTemplate);
    const fields = fieldExtra.sections?.[0]?.fields;
    if (Array.isArray(fields) && fields.length > 0) {
      fields[0].__probe_field_extra = "field-extra";
      variants.push({ name: "custom_extra_field_property", payload: fieldExtra });
    }
  }

  return variants;
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
  const baseTemplate = createReadyTemplate(type, templates[type]);
  const variants = buildVariants(type, baseTemplate);
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
      error_kind: classifyError(create.stderr),
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
  cleanup_enabled: cleanupEnabled,
  probe_scope: "template additional-properties acceptance",
  results,
};

writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
process.stdout.write(`Wrote probe report: ${reportPath}\n`);
