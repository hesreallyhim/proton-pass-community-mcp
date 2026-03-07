import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { PassCliRunner } from "../pass-cli/runner.js";
import type { PassCliVersionPolicy } from "../pass-cli/version.js";
import { createCoreToolDefinitions } from "./tool-definitions-core.js";
import { createItemToolDefinitions } from "./tool-definitions-item.js";
import { registerToolDefinition } from "./tool-definition-types.js";

export function registerTools(
  server: McpServer,
  passCli: PassCliRunner,
  versionPolicy: PassCliVersionPolicy = {},
) {
  const tools = [
    ...createCoreToolDefinitions(passCli, versionPolicy),
    ...createItemToolDefinitions(passCli),
  ];

  for (const tool of tools) {
    registerToolDefinition(server, tool);
  }
}
