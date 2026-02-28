import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function logErr(msg: string) {
  // IMPORTANT: never write to stdout in stdio MCP servers.
  process.stderr.write(`[proton-pass-mcp] ${msg}\n`);
}

async function runPassCli(
  args: string[],
  stdin?: string,
): Promise<{ stdout: string; stderr: string }> {
  const cmd = process.env.PASS_CLI_BIN || "pass-cli";
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
      input: stdin,
    } as any);
    return { stdout: String(stdout ?? ""), stderr: String(stderr ?? "") };
  } catch (e: any) {
    const stderr = String(e?.stderr ?? "");
    const stdout = String(e?.stdout ?? "");
    const code = e?.code;
    const message = e?.message ?? "pass-cli invocation failed";
    throw new Error(
      `pass-cli failed (code=${code ?? "unknown"}): ${message}\n` +
        (stderr ? `stderr:\n${stderr}\n` : "") +
        (stdout ? `stdout:\n${stdout}\n` : ""),
      { cause: e },
    );
  }
}

function asJsonTextOrRaw(text: string): string {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return "";
  try {
    const obj = JSON.parse(trimmed);
    return JSON.stringify(obj, null, 2);
  } catch {
    return trimmed;
  }
}

function requireWriteGate(confirm?: boolean) {
  if (process.env.ALLOW_WRITE !== "1") {
    throw new Error("Write operations are disabled. Set ALLOW_WRITE=1 to enable.");
  }
  if (confirm !== true) {
    throw new Error('Write operation requires explicit confirmation: set {"confirm": true}.');
  }
}

const server = new McpServer({
  name: "proton-pass-cli",
  version: "0.0.1",
});

/** Read-only tools **/
server.registerTool("pass_info", {}, async () => {
  const { stdout } = await runPassCli(["info"]);
  return { content: [{ type: "text", text: stdout.trim() }] };
});

server.registerTool(
  "pass_vault_list",
  {
    inputSchema: z.object({ output: z.enum(["json", "human"]).default("json") }),
    outputSchema: z.enum(["json", "human"]).default("json"),
  },
  async ({ output }) => {
    const { stdout } = await runPassCli(["vault", "list", "--output", output]);
    return { content: [{ type: "text", text: asJsonTextOrRaw(stdout) }] };
  },
);

server.registerTool(
  "pass_item_list",
  {
    inputSchema: z.object({
      vaultName: z.string().optional(),
      shareId: z.string().optional(),
      output: z.enum(["json", "human"]).default("json"),
    }),
  },
  async ({ vaultName, shareId, output }) => {
    if (vaultName && shareId) throw new Error("Provide only one of vaultName or shareId.");

    const args = ["item", "list", "--output", output];
    if (shareId) args.splice(2, 0, "--share-id", shareId);
    else if (vaultName) args.splice(2, 0, vaultName);

    const { stdout } = await runPassCli(args);
    return { content: [{ type: "text", text: asJsonTextOrRaw(stdout) }] };
  },
);

server.registerTool(
  "pass_item_view",
  {
    inputSchema: z.object({
      uri: z.string().optional(), // e.g. pass://Work/GitHub/password
      shareId: z.string().optional(),
      vaultName: z.string().optional(),
      itemId: z.string().optional(),
      itemTitle: z.string().optional(),
      field: z.string().optional(),
      output: z.enum(["json", "human"]).default("json"),
    }),
  },
  async (input) => {
    const { uri, shareId, vaultName, itemId, itemTitle, field, output } = input;

    const usingUri = !!uri;
    const usingSelectors = (shareId || vaultName) && (itemId || itemTitle);

    if (!usingUri && !usingSelectors) {
      throw new Error("Provide either uri OR (shareId|vaultName) AND (itemId|itemTitle).");
    }
    if (usingUri && (shareId || vaultName || itemId || itemTitle)) {
      throw new Error("uri is mutually exclusive with selector arguments.");
    }
    if (shareId && vaultName) throw new Error("shareId and vaultName are mutually exclusive.");
    if (itemId && itemTitle) throw new Error("itemId and itemTitle are mutually exclusive.");

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

    const { stdout } = await runPassCli(args);
    return { content: [{ type: "text", text: asJsonTextOrRaw(stdout) }] };
  },
);

/** Write tools (gated by ALLOW_WRITE=1 + confirm:true) **/

server.registerTool(
  "pass_vault_create",
  { inputSchema: z.object({ name: z.string(), confirm: z.boolean().optional() }) },
  async ({ name, confirm }) => {
    requireWriteGate(confirm);
    const { stdout, stderr } = await runPassCli(["vault", "create", "--name", name]);
    const out = [stdout, stderr].filter(Boolean).join("\n").trim();
    return { content: [{ type: "text", text: out || "OK" }] };
  },
);

server.registerTool(
  "pass_vault_update",
  {
    inputSchema: z.object({
      shareId: z.string().optional(),
      vaultName: z.string().optional(),
      newName: z.string(),
      confirm: z.boolean().optional(),
    }),
  },
  async ({ shareId, vaultName, newName, confirm }) => {
    requireWriteGate(confirm);
    if (!!shareId === !!vaultName) throw new Error("Provide exactly one of shareId or vaultName.");
    const args = ["vault", "update"];
    if (shareId) args.push("--share-id", shareId);
    else args.push("--vault-name", vaultName!);
    args.push("--name", newName);
    const { stdout, stderr } = await runPassCli(args);
    const out = [stdout, stderr].filter(Boolean).join("\n").trim();
    return { content: [{ type: "text", text: out || "OK" }] };
  },
);

server.registerTool(
  "pass_vault_delete",
  {
    inputSchema: z.object({
      shareId: z.string().optional(),
      vaultName: z.string().optional(),
      confirm: z.boolean().optional(),
    }),
  },
  async ({ shareId, vaultName, confirm }) => {
    requireWriteGate(confirm);
    if (!!shareId === !!vaultName) throw new Error("Provide exactly one of shareId or vaultName.");
    const args = ["vault", "delete"];
    if (shareId) args.push("--share-id", shareId);
    else args.push("--vault-name", vaultName!);
    const { stdout, stderr } = await runPassCli(args);
    const out = [stdout, stderr].filter(Boolean).join("\n").trim();
    return { content: [{ type: "text", text: out || "OK" }] };
  },
);

server.registerTool(
  "pass_item_create_login",
  {
    inputSchema: z.object({
      shareId: z.string().optional(),
      vaultName: z.string().optional(),
      title: z.string(),
      username: z.string().optional(),
      email: z.string().optional(),
      password: z.string().optional(),
      url: z.string().optional(),
      generatePassword: z.string().optional(), // if set: pass-cli uses --generate-password[=SETTINGS]
      output: z.enum(["json", "human"]).default("json"),
      confirm: z.boolean().optional(),
    }),
  },
  async (input) => {
    requireWriteGate(input.confirm);
    if (input.shareId && input.vaultName)
      throw new Error("Provide only one of shareId or vaultName.");

    const args: string[] = ["item", "create", "login"];
    if (input.shareId) args.push("--share-id", input.shareId);
    else if (input.vaultName) args.push("--vault-name", input.vaultName);

    args.push("--title", input.title);

    if (input.username) args.push("--username", input.username);
    if (input.email) args.push("--email", input.email);
    if (input.password) args.push("--password", input.password);
    if (input.url) args.push("--url", input.url);

    if (input.generatePassword) {
      if (input.generatePassword === "true") args.push("--generate-password");
      else args.push(`--generate-password=${input.generatePassword}`);
    }

    args.push("--output", input.output);

    const { stdout, stderr } = await runPassCli(args);
    const out = [stdout, stderr].filter(Boolean).join("\n").trim();
    return { content: [{ type: "text", text: asJsonTextOrRaw(out) }] };
  },
);

server.registerTool(
  "pass_item_create_from_template",
  {
    inputSchema: z.object({
      itemType: z.string(), // e.g. "login"
      shareId: z.string().optional(),
      vaultName: z.string().optional(),
      templateJson: z.string(), // JSON string that matches the CLI template format for the item type
      output: z.enum(["json", "human"]).default("json"),
      confirm: z.boolean().optional(),
    }),
  },
  async (input) => {
    requireWriteGate(input.confirm);
    if (input.shareId && input.vaultName)
      throw new Error("Provide only one of shareId or vaultName.");

    const args: string[] = ["item", "create", input.itemType, "--from-template", "-"];
    if (input.shareId) args.push("--share-id", input.shareId);
    else if (input.vaultName) args.push("--vault-name", input.vaultName);

    args.push("--output", input.output);

    const { stdout, stderr } = await runPassCli(args, input.templateJson);
    const out = [stdout, stderr].filter(Boolean).join("\n").trim();
    return { content: [{ type: "text", text: asJsonTextOrRaw(out) }] };
  },
);

server.registerTool(
  "pass_item_update",
  {
    inputSchema: z.object({
      shareId: z.string().optional(),
      vaultName: z.string().optional(),
      itemId: z.string().optional(),
      itemTitle: z.string().optional(),
      fields: z.array(z.string()).min(1), // ["password=...", "username=..."]
      confirm: z.boolean().optional(),
    }),
  },
  async ({ shareId, vaultName, itemId, itemTitle, fields, confirm }) => {
    requireWriteGate(confirm);
    if (shareId && vaultName) throw new Error("Provide only one of shareId or vaultName.");
    if (itemId && itemTitle) throw new Error("Provide only one of itemId or itemTitle.");
    if (!itemId && !itemTitle) throw new Error("Provide itemId or itemTitle.");

    const args: string[] = ["item", "update"];
    if (shareId) args.push("--share-id", shareId);
    else if (vaultName) args.push("--vault-name", vaultName);

    if (itemId) args.push("--item-id", itemId);
    else args.push("--item-title", itemTitle!);

    for (const f of fields) args.push("--field", f);

    const { stdout, stderr } = await runPassCli(args);
    const out = [stdout, stderr].filter(Boolean).join("\n").trim();
    return { content: [{ type: "text", text: out || "OK" }] };
  },
);

server.registerTool(
  "pass_item_delete",
  {
    inputSchema: z.object({
      shareId: z.string(),
      itemId: z.string(),
      confirm: z.boolean().optional(),
    }),
  },
  async ({ shareId, itemId, confirm }) => {
    requireWriteGate(confirm);
    const { stdout, stderr } = await runPassCli([
      "item",
      "delete",
      "--share-id",
      shareId,
      "--item-id",
      itemId,
    ]);
    const out = [stdout, stderr].filter(Boolean).join("\n").trim();
    return { content: [{ type: "text", text: out || "OK" }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
logErr("started");
