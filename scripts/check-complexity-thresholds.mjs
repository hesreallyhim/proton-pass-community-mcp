#!/usr/bin/env node

import { readFileSync } from "node:fs";
import process from "node:process";

const DEFAULT_REPORT_PATH = ".tmp/complexity-report.json";
const DEFAULT_LINE_WARN = 250;
const DEFAULT_LINE_GATE = 500;
const DEFAULT_CC_WARN = 3.0;
const DEFAULT_CC_GATE = 5.0;

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
  const config = {
    reportPath: DEFAULT_REPORT_PATH,
    lineWarn: DEFAULT_LINE_WARN,
    lineGate: DEFAULT_LINE_GATE,
    ccWarn: DEFAULT_CC_WARN,
    ccGate: DEFAULT_CC_GATE,
    enforce: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--enforce") {
      config.enforce = true;
      continue;
    }
    if (arg === "--report") {
      config.reportPath = argv[index + 1] ?? config.reportPath;
      index += 1;
      continue;
    }
    if (arg === "--line-warn") {
      config.lineWarn = Number(argv[index + 1] ?? config.lineWarn);
      index += 1;
      continue;
    }
    if (arg === "--line-gate") {
      config.lineGate = Number(argv[index + 1] ?? config.lineGate);
      index += 1;
      continue;
    }
    if (arg === "--cc-warn") {
      config.ccWarn = Number(argv[index + 1] ?? config.ccWarn);
      index += 1;
      continue;
    }
    if (arg === "--cc-gate") {
      config.ccGate = Number(argv[index + 1] ?? config.ccGate);
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return config;
}

function asNumber(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function main() {
  const config = parseArgs(process.argv.slice(2));
  const report = JSON.parse(readFileSync(config.reportPath, "utf8"));
  const files = Array.isArray(report?.analysis?.byFile) ? report.analysis.byFile : [];
  const ccAvg = asNumber(report?.analysis?.summary?.cyclomaticAveragePerFunction);

  const lineWarnings = [];
  const lineViolations = [];

  for (const file of files) {
    const filePath = String(file?.file ?? "<unknown>");
    const loc = asNumber(file?.loc);
    if (loc > config.lineGate) {
      lineViolations.push({ filePath, loc });
    } else if (loc > config.lineWarn) {
      lineWarnings.push({ filePath, loc });
    }
  }

  for (const warning of lineWarnings) {
    writeWarning(
      `File exceeds warning LOC threshold (${warning.loc} > ${config.lineWarn}): ${warning.filePath}`,
    );
  }

  for (const violation of lineViolations) {
    const message = `File exceeds gate LOC threshold (${violation.loc} > ${config.lineGate}): ${violation.filePath}`;
    if (config.enforce) {
      writeError(message);
    } else {
      writeWarning(`${message} (would fail in enforce mode)`);
    }
  }

  if (ccAvg > config.ccGate) {
    const message = `Cyclomatic average per function exceeds gate (${ccAvg.toFixed(2)} > ${config.ccGate})`;
    if (config.enforce) {
      writeError(message);
    } else {
      writeWarning(`${message} (would fail in enforce mode)`);
    }
  } else if (ccAvg > config.ccWarn) {
    writeWarning(
      `Cyclomatic average per function exceeds warning (${ccAvg.toFixed(2)} > ${config.ccWarn})`,
    );
  }

  writeLine("");
  writeLine("Complexity Threshold Summary");
  writeLine("============================");
  writeLine(`Report: ${config.reportPath}`);
  writeLine(`Mode: ${config.enforce ? "enforce (hard-fail enabled)" : "warn-only"}`);
  writeLine(`LOC warnings: ${lineWarnings.length}`);
  writeLine(`LOC violations: ${lineViolations.length}`);
  writeLine(`CC average/function: ${ccAvg.toFixed(2)}`);

  const shouldFail = config.enforce && (lineViolations.length > 0 || ccAvg > config.ccGate);
  if (shouldFail) {
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  writeError(`complexity-threshold-check failed: ${message}`);
  process.exit(1);
}
