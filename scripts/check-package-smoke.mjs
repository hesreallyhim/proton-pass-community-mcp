import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import {
  createMcpSmokeFixture,
  EXPECTED_TOOL_NAMES,
  ITEM_TEMPLATE_TYPES,
  readMcpSmokeCliCalls,
  readMcpSmokeInvocationContexts,
  SMOKE_RAW_FIELD_VALUE,
  SMOKE_VIEW_SELECTOR_ARGS,
  SMOKE_VIEW_URI_ARGS,
} from "./mcp-smoke-fixture.mjs";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SNAPSHOT_PATH = "docs/testing/item-create-templates.snapshot.json";
const TEMPLATE_INDEX_URI = "pass://templates/item-create";
const REQUEST_OPTIONS = { timeout: 10_000 };
const INHERITED_AGENT_REASON = "Synthetic inherited reason for the packed-package smoke check";
const EXPLICIT_AGENT_REASON = "Read the synthetic password field for the requested smoke check";

async function runNpm(args, cwd) {
  const npmCli = process.env.npm_execpath;
  assert.ok(npmCli, "Run this check with npm run check:package:smoke.");
  const { stdout } = await execFileAsync(process.execPath, [npmCli, ...args], {
    cwd,
    timeout: 120_000,
    killSignal: "SIGKILL",
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  });
  return stdout;
}

async function packAndInstall(temporaryRoot, manifest) {
  const packed = JSON.parse(
    await runNpm(
      ["pack", "--ignore-scripts", "--json", "--pack-destination", temporaryRoot],
      PROJECT_ROOT,
    ),
  );
  assert.equal(packed.length, 1, "Expected exactly one npm package.");
  assert.ok(
    packed[0].files.some((file) => file.path === SNAPSHOT_PATH),
    `The packed package must include the runtime template snapshot: ${SNAPSHOT_PATH}`,
  );

  await writeFile(
    join(temporaryRoot, "package.json"),
    JSON.stringify({ name: "mcp-packed-smoke-consumer", version: "0.0.0", private: true }),
  );
  await runNpm(
    [
      "install",
      "--ignore-scripts",
      "--omit=dev",
      "--no-audit",
      "--no-fund",
      "--package-lock=false",
      "--cache",
      join(temporaryRoot, "npm-cache"),
      join(temporaryRoot, packed[0].filename),
    ],
    temporaryRoot,
  );

  const installedRoot = join(temporaryRoot, "node_modules", manifest.name);
  const installed = JSON.parse(await readFile(join(installedRoot, "package.json"), "utf8"));
  assert.equal(installed.version, manifest.version);
  assert.equal(installed.bin[manifest.name], "dist/index.js");
  await readFile(join(installedRoot, SNAPSHOT_PATH));
  return join(installedRoot, installed.bin[manifest.name]);
}

function parseResource(result, uri) {
  assert.equal(result.contents.length, 1);
  const content = result.contents[0];
  assert.equal(content.uri, uri);
  assert.equal(content.mimeType, "application/json");
  assert.equal(typeof content.text, "string");
  return JSON.parse(content.text);
}

async function checkResources(client) {
  const expectedUris = [
    TEMPLATE_INDEX_URI,
    ...ITEM_TEMPLATE_TYPES.map((type) => `${TEMPLATE_INDEX_URI}/${type}`),
  ];
  const listed = await client.listResources(undefined, REQUEST_OPTIONS);
  assert.deepEqual(listed.resources.map((resource) => resource.uri).sort(), expectedUris.sort());

  const index = parseResource(
    await client.readResource({ uri: TEMPLATE_INDEX_URI }, REQUEST_OPTIONS),
    TEMPLATE_INDEX_URI,
  );
  assert.equal(index.kind, "item-create-template-catalog");
  assert.deepEqual(index.template_types, ITEM_TEMPLATE_TYPES);
  for (const type of ITEM_TEMPLATE_TYPES) {
    const uri = `${TEMPLATE_INDEX_URI}/${type}`;
    const resource = parseResource(await client.readResource({ uri }, REQUEST_OPTIONS), uri);
    assert.equal(resource.kind, "item-create-template");
    assert.equal(resource.type, type);
    assert.ok(resource.template && typeof resource.template === "object");
  }
}

async function checkDeniedWrite(client, fixture) {
  assert.deepEqual(await readMcpSmokeCliCalls(fixture.logPath), []);
  const result = await client.callTool(
    { name: "create_vault", arguments: { name: "Must not be created", confirm: true } },
    undefined,
    REQUEST_OPTIONS,
  );
  assert.equal(result.isError, true, "Writes must fail even when confirm is true.");
  assert.match(result.content[0].text, /write operations are disabled/i);
  assert.deepEqual(
    await readMcpSmokeCliCalls(fixture.logPath),
    [],
    "A write-disabled request must not invoke the CLI.",
  );
}

async function checkRequiredWriteReasons(client, fixture) {
  for (const agentReason of [undefined, " \n\t", "🧪".repeat(301)]) {
    const result = await client.callTool(
      {
        name: "update_vault",
        arguments: {
          shareId: "smoke-share",
          newName: "Must not be changed",
          confirm: true,
          agentReason,
        },
      },
      undefined,
      REQUEST_OPTIONS,
    );
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /agentReason/);
    assert.deepEqual(
      await readMcpSmokeCliCalls(fixture.logPath),
      [],
      "Missing or invalid required reasons must fail before invoking the CLI.",
    );
  }
}

async function checkRead(client, fixture) {
  const result = await client.callTool(
    { name: "list_items", arguments: { shareId: "smoke-share", output: "json" } },
    undefined,
    REQUEST_OPTIONS,
  );
  assert.notEqual(result.isError, true);
  const page = result.structuredContent;
  assert.equal(page.returned, 1);
  assert.equal(page.total, 1);
  assert.equal(page.items[0].id, "smoke-item");
  assert.equal(page.items[0].title, "Smoke login");
  assert.equal(page.items[0].uri, "pass://smoke-share/smoke-item");
  assert.deepEqual(await readMcpSmokeCliCalls(fixture.logPath), [
    ["item", "list", "--share-id", "smoke-share", "--output", "json"],
  ]);
}

async function checkReasonedFieldReads(client, fixture) {
  const inputs = [
    { uri: "pass://smoke-share/smoke-item/password", agentReason: EXPLICIT_AGENT_REASON },
    { shareId: "smoke-share", itemId: "smoke-item", field: "password" },
  ];
  for (const input of inputs) {
    const result = await client.callTool(
      { name: "view_item", arguments: { ...input, output: "json" } },
      undefined,
      REQUEST_OPTIONS,
    );
    assert.notEqual(result.isError, true);
    assert.deepEqual(result.content, [{ type: "text", text: SMOKE_RAW_FIELD_VALUE }]);
  }

  const expectedArgs = [
    ["item", "list", "--share-id", "smoke-share", "--output", "json"],
    SMOKE_VIEW_URI_ARGS,
    SMOKE_VIEW_SELECTOR_ARGS,
  ];
  assert.deepEqual(await readMcpSmokeCliCalls(fixture.logPath), expectedArgs);
  assert.deepEqual(await readMcpSmokeInvocationContexts(fixture.contextLogPath), [
    { args: expectedArgs[0], agentReason: INHERITED_AGENT_REASON },
    { args: SMOKE_VIEW_URI_ARGS, agentReason: EXPLICIT_AGENT_REASON },
    { args: SMOKE_VIEW_SELECTOR_ARGS, agentReason: INHERITED_AGENT_REASON },
  ]);
}

async function checkPackedServer(serverEntrypoint, fixture, manifest) {
  const client = new Client({ name: "packed-package-smoke", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntrypoint],
    cwd: fixture.cwd,
    env: { ...fixture.env, PROTON_PASS_AGENT_REASON: INHERITED_AGENT_REASON },
    stderr: "pipe",
  });
  let stderr = "";
  transport.stderr.on("data", (chunk) => {
    stderr = (stderr + String(chunk)).slice(-8192);
  });

  try {
    await client.connect(transport, REQUEST_OPTIONS);
    assert.deepEqual(client.getServerVersion(), { name: manifest.name, version: manifest.version });
    const listed = await client.listTools(undefined, REQUEST_OPTIONS);
    assert.deepEqual(listed.tools.map((tool) => tool.name).sort(), EXPECTED_TOOL_NAMES);
    await checkResources(client);
    await checkDeniedWrite(client, fixture);
    await checkRequiredWriteReasons(client, fixture);
    await checkRead(client, fixture);
    await checkReasonedFieldReads(client, fixture);
  } catch (error) {
    throw new Error(`${error.message}\nPacked server stderr:\n${stderr}`, { cause: error });
  } finally {
    await client.close();
  }
}

async function main() {
  const manifest = JSON.parse(await readFile(join(PROJECT_ROOT, "package.json"), "utf8"));
  const temporaryRoot = await mkdtemp(join(tmpdir(), "proton-pass-package-smoke-"));
  try {
    const serverEntrypoint = await packAndInstall(temporaryRoot, manifest);
    const fixture = await createMcpSmokeFixture(join(temporaryRoot, "fixture"));
    await checkPackedServer(serverEntrypoint, fixture, manifest);
    process.stdout.write(
      `Packed package smoke passed: initialize, ${EXPECTED_TOOL_NAMES.length} tools, ` +
        `${ITEM_TEMPLATE_TYPES.length + 1} template resources, item reads with per-call reasons and raw fields, ` +
        "and denied writes/invalid required reasons (zero CLI calls).\n",
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`Packed package smoke failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
