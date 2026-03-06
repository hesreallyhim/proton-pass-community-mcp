#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import process from "node:process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const snapshotPath = resolve(projectRoot, "docs/testing/item-create-templates.snapshot.json");
const passDev = resolve(projectRoot, "scripts/pass-dev.sh");
const mode = process.argv[2] ?? "--check";

if (mode !== "--check" && mode !== "--write") {
  process.stderr.write(
    "Usage: node scripts/check-item-create-template-drift.mjs [--check|--write]\n",
  );
  process.exit(2);
}

function runPassDev(args) {
  const result = spawnSync(passDev, args, { encoding: "utf8" });
  if (result.status !== 0) {
    const stderr = (result.stderr ?? "").trim();
    const stdout = (result.stdout ?? "").trim();
    const detail = [stderr, stdout].filter(Boolean).join("\n");
    throw new Error(`pass-dev command failed: ${args.join(" ")}\n${detail}`);
  }
  return (result.stdout ?? "").trim();
}

function canonicalJson(value) {
  return JSON.stringify(value);
}

const baseline = JSON.parse(readFileSync(snapshotPath, "utf8"));
const baselineTemplates = baseline?.templates ?? {};
const types = Object.keys(baselineTemplates).sort();

if (types.length === 0) {
  throw new Error("No template types found in baseline snapshot.");
}

const currentTemplates = {};
for (const type of types) {
  const templateText = runPassDev(["item", "create", type, "--get-template"]);
  currentTemplates[type] = JSON.parse(templateText);
}

const current = {
  captured_at: new Date().toISOString(),
  captured_by: "scripts/pass-dev.sh item create <type> --get-template",
  pass_cli_version: runPassDev(["--version"]),
  templates: currentTemplates,
};

if (mode === "--write") {
  writeFileSync(snapshotPath, JSON.stringify(current, null, 2) + "\n");
  process.stdout.write(`Updated snapshot: ${snapshotPath}\n`);
  process.exit(0);
}

const drifts = [];
for (const type of types) {
  const expected = baselineTemplates[type];
  const actual = currentTemplates[type];
  if (canonicalJson(expected) !== canonicalJson(actual)) {
    drifts.push(type);
  }
}

if (drifts.length > 0) {
  const actualPath = resolve(projectRoot, "docs/testing/item-create-templates.actual.json");
  writeFileSync(actualPath, JSON.stringify(current, null, 2) + "\n");
  process.stderr.write(
    [
      "Item-create template drift detected.",
      `Types with drift: ${drifts.join(", ")}`,
      `Wrote actual snapshot candidate: ${actualPath}`,
      "If intentional, update baseline with:",
      "  node scripts/check-item-create-template-drift.mjs --write",
    ].join("\n") + "\n",
  );
  process.exit(1);
}

process.stdout.write(
  `Item-create template snapshot is current for ${types.length} type(s). CLI: ${current.pass_cli_version}\n`,
);
