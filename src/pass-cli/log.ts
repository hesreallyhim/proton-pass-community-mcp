export function logErr(msg: string) {
  // IMPORTANT: never write to stdout in stdio MCP servers.
  process.stderr.write(`[proton-pass-mcp] ${msg}\n`);
}
