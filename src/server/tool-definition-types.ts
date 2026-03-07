import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { withAuthErrorHandling } from "../pass-cli/errors.js";

export type NoInputTool = {
  kind: "no-input";
  name: string;
  description: string;
  handler: () => Promise<any>;
  auth?: boolean;
};

export type InputTool = {
  kind: "input";
  name: string;
  description: string;
  inputSchema: any;
  handler: (input: any) => Promise<any>;
  auth?: boolean;
};

export type ToolDefinition = NoInputTool | InputTool;

export function noInputTool(
  name: string,
  description: string,
  handler: () => Promise<any>,
  auth = true,
): NoInputTool {
  return { kind: "no-input", name, description, handler, auth };
}

export function inputTool(
  name: string,
  description: string,
  inputSchema: any,
  handler: (input: any) => Promise<any>,
  auth = true,
): InputTool {
  return { kind: "input", name, description, inputSchema, handler, auth };
}

export function registerToolDefinition(server: McpServer, tool: ToolDefinition): void {
  if (tool.kind === "input") {
    const handler = tool.auth === false ? tool.handler : withAuthErrorHandling(tool.handler);
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema as any },
      handler as any,
    );
    return;
  }

  const handler = tool.auth === false ? tool.handler : withAuthErrorHandling(tool.handler);
  server.registerTool(tool.name, { description: tool.description }, handler as any);
}
