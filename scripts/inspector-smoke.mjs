import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import process from "node:process";

const execFileAsync = promisify(execFile);

function getInspectorBin() {
  return process.platform === "win32" ? "mcp-inspector.cmd" : "mcp-inspector";
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runInspector(args, env = {}) {
  const { stdout } = await execFileAsync(getInspectorBin(), args, {
    env: {
      ...process.env,
      ...env,
    },
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(String(stdout).trim());
}

async function main() {
  const projectRoot = process.cwd();
  const serverCommand = ["node", "dist/index.js"];
  const passCliMock = path.resolve(projectRoot, "test/fixtures/pass-cli-mock.sh");

  const toolsList = await runInspector([
    "--cli",
    "--transport",
    "stdio",
    "--method",
    "tools/list",
    "--",
    ...serverCommand,
  ]);

  const toolNames = new Set(toolsList.tools.map((tool) => tool.name));

  // Verify all v0.1 read-only tools are registered
  const expectedTools = [
    "view_session_info",
    "view_user_info",
    "check_status",
    "list_vaults",
    "list_shares",
    "list_items",
    "search_items",
    "view_item",
  ];
  for (const tool of expectedTools) {
    assert(toolNames.has(tool), `Expected ${tool} tool to be registered`);
  }

  // Verify mutative tools are NOT registered in v0.1
  const excludedTools = [
    "create_vault",
    "update_vault",
    "delete_vault",
    "create_login_item",
    "create_login_item_from_template",
    "update_item",
    "delete_item",
  ];
  for (const tool of excludedTools) {
    assert(!toolNames.has(tool), `Expected ${tool} to NOT be registered in v0.1`);
  }

  assert(
    toolNames.size === expectedTools.length,
    `Expected exactly ${expectedTools.length} tools, got ${toolNames.size}`,
  );

  const passInfoResult = await runInspector(
    [
      "--cli",
      "--transport",
      "stdio",
      "--method",
      "tools/call",
      "--tool-name",
      "view_session_info",
      "--",
      ...serverCommand,
    ],
    {
      PASS_CLI_BIN: passCliMock,
    },
  );

  const content = passInfoResult?.content?.[0]?.text;
  assert(typeof content === "string", "Expected view_session_info response text content");
  assert(
    content.includes("mock-pass-info"),
    "Expected view_session_info to return mock pass-cli output",
  );

  process.stdout.write("Inspector smoke checks passed.\n");
}

main().catch((error) => {
  process.stderr.write(
    `Inspector smoke checks failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
