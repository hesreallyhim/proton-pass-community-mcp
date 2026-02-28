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

  assert(toolNames.has("pass_info"), "Expected pass_info tool to be registered");
  assert(toolNames.has("pass_item_view"), "Expected pass_item_view tool to be registered");
  assert(toolNames.has("pass_item_delete"), "Expected pass_item_delete tool to be registered");

  const passInfoResult = await runInspector(
    [
      "--cli",
      "--transport",
      "stdio",
      "--method",
      "tools/call",
      "--tool-name",
      "pass_info",
      "--",
      ...serverCommand,
    ],
    {
      PASS_CLI_BIN: passCliMock,
    },
  );

  const content = passInfoResult?.content?.[0]?.text;
  assert(typeof content === "string", "Expected pass_info response text content");
  assert(content.includes("mock-pass-info"), "Expected pass_info to return mock pass-cli output");

  process.stdout.write("Inspector smoke checks passed.\n");
}

main().catch((error) => {
  process.stderr.write(
    `Inspector smoke checks failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
