export function logErr(msg: string) {
  // IMPORTANT: never write to stdout in stdio MCP servers.
  process.stderr.write(`[proton-pass-community-mcp] ${msg}\n`);
}
