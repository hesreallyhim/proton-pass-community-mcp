import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { logErr } from "./pass-cli/log.js";
import { runPassCli, type PassCliRunner } from "./pass-cli/runner.js";
import type { PassCliVersionPolicy } from "./pass-cli/version.js";
import { registerTools } from "./server/register-tools.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8")) as {
  version: string;
};

export * from "./pass-cli/errors.js";
export * from "./pass-cli/log.js";
export * from "./pass-cli/output.js";
export * from "./pass-cli/runner.js";
export * from "./pass-cli/version.js";
export * from "./tools/check-status.js";
export * from "./tools/item.js";
export * from "./tools/session.js";
export * from "./tools/share.js";
export * from "./tools/vault.js";
export * from "./tools/write-gate.js";

export function createServer(
  deps: { runPassCli?: PassCliRunner; versionPolicy?: PassCliVersionPolicy } = {},
) {
  const passCli = deps.runPassCli ?? runPassCli;
  const server = new McpServer({
    name: "proton-pass-community-mcp",
    version: pkg.version,
  });

  registerTools(server, passCli, deps.versionPolicy);

  return server;
}

export async function startServer(
  options: {
    server?: Pick<McpServer, "connect">;
    transport?: StdioServerTransport;
    onStarted?: (message: string) => void;
    createServerDeps?: Parameters<typeof createServer>[0];
  } = {},
) {
  const server = options.server ?? createServer(options.createServerDeps);
  const transport = options.transport ?? new StdioServerTransport();
  await server.connect(transport);
  const onStarted = options.onStarted ?? logErr;
  onStarted("started");
}
