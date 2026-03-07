#!/usr/bin/env node

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const DEFAULT_ROOTS = ["src"];
const SUPPORTED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const SKIP_DIRECTORIES = new Set([".git", "dist", "coverage", "node_modules"]);
const INLINE_ALLOW_MARKER = "hygiene:allow-debug";

const PATTERNS = [
  { id: "console.debug", regex: /\bconsole\.debug\s*\(/ },
  { id: "console.trace", regex: /\bconsole\.trace\s*\(/ },
  { id: "console.log", regex: /\bconsole\.log\s*\(/ },
  { id: "debugger", regex: /\bdebugger\b/ },
];

function writeLine(message = "") {
  process.stdout.write(`${message}\n`);
}

function writeWarning(message) {
  if (process.env.GITHUB_ACTIONS === "true") {
    writeLine(`::warning::${message}`);
    return;
  }
  writeLine(`WARNING: ${message}`);
}

function writeError(message) {
  if (process.env.GITHUB_ACTIONS === "true") {
    writeLine(`::error::${message}`);
    return;
  }
  writeLine(`ERROR: ${message}`);
}

function parseArgs(argv) {
  const options = {
    enforce: false,
    roots: [...DEFAULT_ROOTS],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--enforce") {
      options.enforce = true;
      continue;
    }
    if (arg === "--root") {
      const root = argv[index + 1];
      if (!root) {
        throw new Error("--root expects a directory path");
      }
      options.roots.push(root);
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function collectFiles(dir, files = []) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name)) {
        continue;
      }
      collectFiles(entryPath, files);
      continue;
    }
    if (entry.isFile() && SUPPORTED_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }
  return files;
}

function analyzeFile(filePath) {
  const findings = [];
  const content = readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (line.includes(INLINE_ALLOW_MARKER)) {
      continue;
    }

    for (const pattern of PATTERNS) {
      if (pattern.regex.test(line)) {
        findings.push({
          filePath,
          line: lineIndex + 1,
          rule: pattern.id,
          source: line.trim(),
        });
      }
    }
  }

  return findings;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const rootSet = new Set(options.roots.map((root) => path.normalize(root)));
  const files = [];

  for (const root of rootSet) {
    const absoluteRoot = path.resolve(root);
    collectFiles(absoluteRoot, files);
  }

  const findings = [];
  for (const file of files) {
    findings.push(...analyzeFile(file));
  }

  for (const finding of findings) {
    const relativeFile = path.relative(process.cwd(), finding.filePath);
    const message = `${relativeFile}:${finding.line} disallowed production debug pattern (${finding.rule}) -> ${finding.source}`;
    if (options.enforce) {
      writeError(message);
    } else {
      writeWarning(`${message} (warn-only mode)`);
    }
  }

  writeLine("");
  writeLine("Production Hygiene Summary");
  writeLine("==========================");
  writeLine(`Mode: ${options.enforce ? "enforce (hard-fail enabled)" : "warn-only"}`);
  writeLine(`Roots: ${Array.from(rootSet).join(", ")}`);
  writeLine(`Files scanned: ${files.length}`);
  writeLine(`Findings: ${findings.length}`);
  writeLine(`Allowed inline marker: ${INLINE_ALLOW_MARKER}`);

  if (options.enforce && findings.length > 0) {
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  writeError(`production-hygiene-check failed: ${message}`);
  process.exit(1);
}
