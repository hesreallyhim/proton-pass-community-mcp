#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";
import process from "node:process";

import { format as formatWithPrettier } from "prettier";
import ts from "typescript";

const SUPPORTED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const DEFAULT_TARGET_DIRS = ["src", "test"];
const DEFAULT_TOP = 10;

function println(line = "") {
  process.stdout.write(`${line}\n`);
}

function fail(message) {
  process.stderr.write(`complexity-report failed: ${message}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const targets = [];
  let top = DEFAULT_TOP;
  let jsonOut;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--top") {
      const value = argv[index + 1];
      if (!value || !/^\d+$/.test(value)) {
        throw new Error("Invalid --top value; expected a positive integer.");
      }
      top = Number(value);
      index += 1;
      continue;
    }

    if (arg === "--json-out") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --json-out.");
      }
      jsonOut = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    targets.push(arg);
  }

  return {
    targets: targets.length > 0 ? targets : DEFAULT_TARGET_DIRS,
    top,
    jsonOut,
  };
}

function collectSourceFiles(pathname, files = []) {
  if (!existsSync(pathname)) return files;

  const stat = statSync(pathname);
  if (stat.isFile()) {
    if (SUPPORTED_EXTENSIONS.has(extname(pathname))) {
      files.push(pathname);
    }
    return files;
  }

  if (!stat.isDirectory()) return files;

  const entries = readdirSync(pathname, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "coverage") {
      continue;
    }

    const child = join(pathname, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(child, files);
      continue;
    }

    if (entry.isFile() && SUPPORTED_EXTENSIONS.has(extname(entry.name))) {
      files.push(child);
    }
  }

  return files;
}

function runClocByFile(targets) {
  const clocBin = process.platform === "win32" ? "cloc.cmd" : "cloc";
  const output = execFileSync(
    clocBin,
    ["--by-file", "--json", "--include-ext=ts,tsx,js,mjs,cjs", ...targets],
    { encoding: "utf8" },
  );

  const parsed = JSON.parse(output);
  const summary = parsed.SUM ?? {};
  const byFile = {};

  for (const [key, value] of Object.entries(parsed)) {
    if (key === "header" || key === "SUM" || key === "TypeScript" || key === "JavaScript") {
      continue;
    }

    const row = value;
    if (!row || typeof row !== "object") {
      continue;
    }

    const rel = String(key).replace(/\\/g, "/");
    byFile[rel] = {
      blank: Number(row.blank ?? 0),
      comment: Number(row.comment ?? 0),
      code: Number(row.code ?? 0),
      loc: Number(row.blank ?? 0) + Number(row.comment ?? 0) + Number(row.code ?? 0),
    };
  }

  return {
    summary: {
      files: Number(summary.nFiles ?? 0),
      blank: Number(summary.blank ?? 0),
      comment: Number(summary.comment ?? 0),
      code: Number(summary.code ?? 0),
      loc: Number(summary.blank ?? 0) + Number(summary.comment ?? 0) + Number(summary.code ?? 0),
    },
    byFile,
  };
}

function isFunctionLikeNode(node) {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node) ||
    ts.isArrowFunction(node) ||
    ts.isFunctionExpression(node)
  );
}

function nodeName(node, sourceFile) {
  if ("name" in node && node.name) {
    if (ts.isIdentifier(node.name)) {
      return node.name.text;
    }
    return node.name.getText(sourceFile);
  }

  const parent = node.parent;
  if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
    return parent.name.text;
  }

  if (parent && ts.isPropertyAssignment(parent)) {
    return parent.name.getText(sourceFile);
  }

  if (
    parent &&
    ts.isBinaryExpression(parent) &&
    parent.operatorToken.kind === ts.SyntaxKind.EqualsToken
  ) {
    return parent.left.getText(sourceFile);
  }

  const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
  return `<anonymous@${line}>`;
}

function isDecisionNode(node) {
  if (
    ts.isIfStatement(node) ||
    ts.isForStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node) ||
    ts.isConditionalExpression(node) ||
    ts.isCatchClause(node)
  ) {
    return true;
  }

  if (ts.isCaseClause(node)) {
    return true;
  }

  if (ts.isBinaryExpression(node)) {
    const operator = node.operatorToken.kind;
    return (
      operator === ts.SyntaxKind.AmpersandAmpersandToken ||
      operator === ts.SyntaxKind.BarBarToken ||
      operator === ts.SyntaxKind.QuestionQuestionToken
    );
  }

  return false;
}

function isLogicalStatement(node) {
  if (!ts.isStatement(node)) {
    return false;
  }

  return !ts.isBlock(node) && !ts.isEmptyStatement(node);
}

function countCyclomaticForFunction(functionNode) {
  let complexity = 1;

  const visit = (node) => {
    if (node !== functionNode && isFunctionLikeNode(node)) {
      return;
    }

    if (isDecisionNode(node)) {
      complexity += 1;
    }

    ts.forEachChild(node, visit);
  };

  if (functionNode.body) {
    visit(functionNode.body);
  }

  return complexity;
}

function countLlocForFunction(functionNode) {
  let count = 0;

  const visit = (node) => {
    if (node !== functionNode && isFunctionLikeNode(node)) {
      return;
    }

    if (isLogicalStatement(node)) {
      count += 1;
    }

    ts.forEachChild(node, visit);
  };

  if (functionNode.body) {
    visit(functionNode.body);
  }

  return count;
}

function countFileLloc(sourceFile) {
  let count = 0;

  const visit = (node) => {
    if (isLogicalStatement(node)) {
      count += 1;
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return count;
}

function analyzeFiles(files, clocByFile) {
  const byFile = [];
  const byFunction = [];

  let parseErrorCount = 0;
  let cyclomaticTotal = 0;
  let llocTotal = 0;

  for (const file of files) {
    const rel = relative(process.cwd(), file).replace(/\\/g, "/");
    const source = readFileSync(file, "utf8");
    const scriptKind = extname(file) === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind);

    parseErrorCount += sourceFile.parseDiagnostics.length;

    let fileCyclomatic = 0;
    let functionCount = 0;

    const visit = (node) => {
      if (isFunctionLikeNode(node)) {
        functionCount += 1;
        const complexity = countCyclomaticForFunction(node);
        const lloc = countLlocForFunction(node);
        fileCyclomatic += complexity;

        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
        const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1;

        byFunction.push({
          file: rel,
          name: nodeName(node, sourceFile),
          cyclomatic: complexity,
          lloc,
          lineStart: start,
          lineEnd: end,
        });
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    const fileLloc = countFileLloc(sourceFile);
    cyclomaticTotal += fileCyclomatic;
    llocTotal += fileLloc;

    const clocRow = clocByFile[rel] ?? { code: 0, comment: 0, blank: 0, loc: 0 };

    byFile.push({
      file: rel,
      sloc: clocRow.code,
      comment: clocRow.comment,
      blank: clocRow.blank,
      loc: clocRow.loc,
      lloc: fileLloc,
      cyclomatic: fileCyclomatic,
      functionCount,
    });
  }

  return {
    summary: {
      filesAnalyzed: byFile.length,
      functionCount: byFunction.length,
      parseErrors: parseErrorCount,
      cyclomaticTotal,
      cyclomaticAveragePerFunction:
        byFunction.length > 0 ? Number((cyclomaticTotal / byFunction.length).toFixed(2)) : 0,
      llocTotal,
    },
    byFile,
    byFunction,
  };
}

function topN(items, top, selector) {
  return [...items].sort((left, right) => selector(right) - selector(left)).slice(0, top);
}

function printSummary(report, top) {
  const { cloc, analysis } = report;

  println("Complexity Report");
  println("=================");
  println(`Targets: ${report.targets.join(", ")}`);
  println(`Files analyzed: ${analysis.summary.filesAnalyzed}`);
  println(`Functions analyzed: ${analysis.summary.functionCount}`);
  println(`SLOC (cloc code): ${cloc.summary.code}`);
  println(`LOC (physical, cloc): ${cloc.summary.loc}`);
  println(`LLOC (estimated logical statements): ${analysis.summary.llocTotal}`);
  println(`Cyclomatic total: ${analysis.summary.cyclomaticTotal}`);
  println(`Cyclomatic avg/function: ${analysis.summary.cyclomaticAveragePerFunction}`);
  println(`Parser diagnostics: ${analysis.summary.parseErrors}`);
  println("");

  const topFiles = topN(analysis.byFile, top, (item) => item.cyclomatic);
  println(`Top ${topFiles.length} files by cyclomatic complexity:`);
  for (const file of topFiles) {
    println(`- ${file.file}: cyc=${file.cyclomatic}, sloc=${file.sloc}, lloc=${file.lloc}`);
  }
  println("");

  const topFunctions = topN(analysis.byFunction, top, (item) => item.cyclomatic);
  println(`Top ${topFunctions.length} functions by cyclomatic complexity:`);
  for (const fn of topFunctions) {
    println(
      `- ${basename(fn.file)}::${fn.name} (${fn.file}:${fn.lineStart}): cyc=${fn.cyclomatic}, lloc=${fn.lloc}`,
    );
  }
}

async function main() {
  const { targets, top, jsonOut } = parseArgs(process.argv.slice(2));
  const files = targets.flatMap((target) => collectSourceFiles(target, []));

  if (files.length === 0) {
    throw new Error(`No source files found in: ${targets.join(", ")}`);
  }

  const cloc = runClocByFile(targets);
  const analysis = analyzeFiles(files, cloc.byFile);

  const report = {
    generatedAt: new Date().toISOString(),
    targets,
    cloc,
    analysis,
  };

  printSummary(report, top);

  if (jsonOut) {
    const rawJson = JSON.stringify(report);
    const formattedJson = await formatWithPrettier(rawJson, { parser: "json" });
    writeFileSync(
      jsonOut,
      formattedJson.endsWith("\n") ? formattedJson : `${formattedJson}\n`,
      "utf8",
    );
    println("");
    println(`Wrote JSON report: ${jsonOut}`);
  }
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  fail(message);
}
