import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js";

import {
  createMcpSmokeFixture,
  EXPECTED_TOOL_NAMES,
  ITEM_TEMPLATE_TYPES,
  readMcpSmokeCliCalls,
} from "./mcp-smoke-fixture.mjs";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function getInspectorEntrypoint() {
  const manifestPath = require.resolve("@modelcontextprotocol/inspector/package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  return resolve(dirname(manifestPath), manifest.bin["mcp-inspector"]);
}

function inspectorEnvironment(temporaryRoot) {
  return {
    ...getDefaultEnvironment(),
    MCP_AUTO_OPEN_ENABLED: "false",
    MCP_INSPECTOR_SECRET_STORE: "memory",
    MCP_STORAGE_DIR: join(temporaryRoot, "storage"),
    MCP_INSPECTOR_OAUTH_STATE_PATH: join(temporaryRoot, "oauth.json"),
    MCP_CLIENT_CONFIG_PATH: join(temporaryRoot, "client.json"),
    // A regression in target parsing must not fall back to the user's catalog.
    MCP_CATALOG_PATH: join(temporaryRoot, "fallback-catalog.json"),
  };
}

function inspectorArgs(fixture, methodArgs) {
  return [
    "--cli",
    process.execPath,
    join(PROJECT_ROOT, "dist", "index.js"),
    // Inspector v2 takes the target BEFORE -- and its own options AFTER it.
    "--",
    "--transport",
    "stdio",
    "--cwd",
    fixture.cwd,
    "--format",
    "json",
    "--connect-timeout",
    "10000",
    ...Object.entries(fixture.env).flatMap(([key, value]) => ["-e", `${key}=${value}`]),
    ...methodArgs,
  ];
}

async function runInspector(entrypoint, fixture, env, args) {
  try {
    const result = await execFileAsync(
      process.execPath,
      [entrypoint, ...inspectorArgs(fixture, args)],
      {
        cwd: PROJECT_ROOT,
        env,
        timeout: 30_000,
        killSignal: "SIGKILL",
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true,
      },
    );
    return { ...result, exitCode: 0 };
  } catch (error) {
    if (typeof error.code !== "number") throw error;
    return { stdout: error.stdout, stderr: error.stderr, exitCode: error.code };
  }
}

function successResult(result) {
  assert.equal(result.exitCode, 0, `Inspector failed:\n${result.stderr}`);
  const envelope = JSON.parse(result.stdout);
  assert.ok(envelope.result, "Expected Inspector v2's JSON result envelope.");
  return envelope.result;
}

function assertToolError(result, code) {
  assert.equal(result.exitCode, 5, `Expected Inspector tool-error exit code 5:\n${result.stderr}`);
  const errorLine = result.stderr.trim().split(/\r?\n/).at(-1);
  const envelope = JSON.parse(errorLine);
  assert.equal(envelope.error.code, code);
  assert.equal(typeof envelope.error.message, "string");
}

async function checkToolsAndResources(run) {
  const listed = successResult(await run(["--method", "tools/list"]));
  assert.deepEqual(listed.tools.map((tool) => tool.name).sort(), EXPECTED_TOOL_NAMES);
  const resources = successResult(
    await run(["--method", "resources/read", "--uri", "pass://templates/item-create"]),
  );
  const catalog = JSON.parse(resources.contents[0].text);
  assert.equal(catalog.kind, "item-create-template-catalog");
  assert.deepEqual(catalog.template_types, ITEM_TEMPLATE_TYPES);
}

async function checkToolErrors(run, fixture) {
  assert.deepEqual(await readMcpSmokeCliCalls(fixture.logPath), []);
  const denied = await run([
    "--method",
    "tools/call",
    "--tool-name",
    "create_vault",
    "--tool-args-json",
    JSON.stringify({ name: "Must not be created", confirm: true }),
  ]);
  assertToolError(denied, "tool_is_error");
  const result = JSON.parse(denied.stdout).result;
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /write operations are disabled/i);

  const unknown = await run(["--method", "tools/call", "--tool-name", "smoke_tool_does_not_exist"]);
  assertToolError(unknown, "tool_not_found");
  assert.deepEqual(
    await readMcpSmokeCliCalls(fixture.logPath),
    [],
    "Denied writes and missing tools must not invoke the CLI.",
  );
}

async function checkSafeRead(run, fixture) {
  const result = successResult(
    await run(["--method", "tools/call", "--tool-name", "view_session_info"]),
  );
  assert.notEqual(result.isError, true);
  assert.match(result.content[0].text, /mock-pass-info/);
  assert.deepEqual(await readMcpSmokeCliCalls(fixture.logPath), [["info", "--output", "json"]]);
}

async function main() {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "proton-pass-inspector-smoke-"));
  try {
    const fixture = await createMcpSmokeFixture(join(temporaryRoot, "fixture"));
    const env = inspectorEnvironment(temporaryRoot);
    await writeFile(env.MCP_CATALOG_PATH, '{"mcpServers":{}}\n');
    const entrypoint = await getInspectorEntrypoint();
    const run = (args) => runInspector(entrypoint, fixture, env, args);
    await checkToolsAndResources(run);
    await checkToolErrors(run, fixture);
    await checkSafeRead(run, fixture);
    process.stdout.write(
      `Inspector v2 smoke passed: ${EXPECTED_TOOL_NAMES.length} tools, template catalog, ` +
        "safe read, denied write (zero CLI calls), and exit-5 JSON error envelopes.\n",
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`Inspector smoke failed: ${error.message}\n`);
  process.exitCode = 1;
});
