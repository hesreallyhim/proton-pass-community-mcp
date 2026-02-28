import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function runPassCli(args: string[]) {
  const cmd = process.env.PASS_CLI_BIN || "pass-cli";
  const { stdout, stderr } = await execFileAsync(cmd, args, {
    env: process.env,
    maxBuffer: 10 * 1024 * 1024
  });
  if (stderr) {
    throw new Error(stderr);
  }
  return stdout;
}

function asJsonTextOrRaw(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text.trim();
  }
}

const server = new McpServer({
  name: "proton-pass-cli",
  version: "0.0.1"
});

server.tool("pass_info", {}, async () => {
  const stdout = await runPassCli(["info"]);
  return { content: [{ type: "text", text: stdout.trim() }] };
});

server.tool(
  "pass_vault_list",
  {
    output: z.enum(["json", "human"]).default("json")
  },
  async ({ output }) => {
    const stdout = await runPassCli(["vault", "list", "--output", output]);
    return { content: [{ type: "text", text: asJsonTextOrRaw(stdout) }] };
  }
);

server.tool(
  "pass_item_list",
  {
    vaultName: z.string().optional(),
    shareId: z.string().optional(),
    output: z.enum(["json", "human"]).default("json")
  },
  async ({ vaultName, shareId, output }) => {
    if (vaultName && shareId) {
      throw new Error("Provide only one of vaultName or shareId.");
    }

    const args = ["item", "list", "--output", output];
    if (shareId) args.splice(2, 0, "--share-id", shareId);
    else if (vaultName) args.splice(2, 0, vaultName);

    const stdout = await runPassCli(args);
    return { content: [{ type: "text", text: asJsonTextOrRaw(stdout) }] };
  }
);

server.tool(
  "pass_item_view",
  {
    uri: z.string().optional(),
    shareId: z.string().optional(),
    vaultName: z.string().optional(),
    itemId: z.string().optional(),
    itemTitle: z.string().optional(),
    field: z.string().optional(),
    output: z.enum(["json", "human"]).default("json")
  },
  async (input) => {
    const { uri, shareId, vaultName, itemId, itemTitle, field, output } = input;

    const usingUri = !!uri;
    const usingSelectors = (shareId || vaultName) && (itemId || itemTitle);

    if (!usingUri && !usingSelectors) {
      throw new Error("Provide either uri OR (shareId|vaultName) AND (itemId|itemTitle).");
    }

    const args: string[] = ["item", "view"];

    if (usingUri) {
      args.push("--output", output, uri!);
    } else {
      if (shareId) args.push("--share-id", shareId);
      else args.push("--vault-name", vaultName!);

      if (itemId) args.push("--item-id", itemId);
      else args.push("--item-title", itemTitle!);

      if (field) args.push("--field", field);
      args.push("--output", output);
    }

    const stdout = await runPassCli(args);
    return { content: [{ type: "text", text: asJsonTextOrRaw(stdout) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
