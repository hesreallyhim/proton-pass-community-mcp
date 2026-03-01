import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";

const execFileAsync = promisify(execFile);

export type PassCliResult = { stdout: string; stderr: string };
export type PassCliRunner = (args: string[], stdin?: string) => Promise<PassCliResult>;

type ExecFileAsyncLike = (
  file: string,
  args: readonly string[],
  options: {
    env: NodeJS.ProcessEnv;
    maxBuffer: number;
    input?: string;
  },
) => Promise<{ stdout?: string | Buffer; stderr?: string | Buffer }>;

function asTextContent(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export type PassCliAuthErrorCode = "AUTH_REQUIRED" | "AUTH_EXPIRED";

export class PassCliAuthError extends Error {
  readonly name = "PassCliAuthError";
  readonly retryable = true;
  readonly userAction = 'Run "pass-cli login" outside MCP, then retry this tool.';

  constructor(
    readonly code: PassCliAuthErrorCode,
    readonly details?: string,
  ) {
    const description =
      code === "AUTH_EXPIRED"
        ? "Proton Pass session expired."
        : "Proton Pass authentication is required.";
    super(
      `[${code}] ${description} Authentication is user-managed outside MCP. ` +
        "Do not provide credentials, OTP codes, or keys to the model. " +
        'Run "pass-cli login" in your terminal and retry.',
    );
  }
}

function joinStdoutStderr(stdout: string, stderr: string): string {
  return [stdout, stderr].filter(Boolean).join("\n").trim();
}

export function classifyPassCliAuthErrorText(text: string): PassCliAuthErrorCode | null {
  const normalized = (text ?? "").toLowerCase();

  if (
    normalized.includes("session expired") ||
    normalized.includes("expired session") ||
    (normalized.includes("token") && normalized.includes("expired"))
  ) {
    return "AUTH_EXPIRED";
  }

  if (
    normalized.includes("not logged in") ||
    normalized.includes("please login") ||
    normalized.includes("please log in") ||
    normalized.includes("requires an authenticated client") ||
    normalized.includes("authentication required") ||
    normalized.includes("unauthorized") ||
    normalized.includes("forbidden")
  ) {
    return "AUTH_REQUIRED";
  }

  return null;
}

function asAuthErrorToolResult(error: PassCliAuthError) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: error.message }],
    structuredContent: {
      error_code: error.code,
      retryable: error.retryable,
      user_action: error.userAction,
      auth_managed_by_user: true,
    },
  };
}

function withAuthErrorHandling<TArgs extends unknown[], TResult>(
  handler: (...args: TArgs) => Promise<TResult>,
) {
  return async (...args: TArgs): Promise<TResult | ReturnType<typeof asAuthErrorToolResult>> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof PassCliAuthError) {
        return asAuthErrorToolResult(error);
      }
      throw error;
    }
  };
}

export function logErr(msg: string) {
  // IMPORTANT: never write to stdout in stdio MCP servers.
  process.stderr.write(`[proton-pass-mcp] ${msg}\n`);
}

export function createRunPassCli(
  execFileImpl: ExecFileAsyncLike = execFileAsync as ExecFileAsyncLike,
) {
  return async (args: string[], stdin?: string): Promise<PassCliResult> => {
    const cmd = process.env.PASS_CLI_BIN || "pass-cli";
    try {
      const { stdout, stderr } = await execFileImpl(cmd, args, {
        env: process.env,
        maxBuffer: 10 * 1024 * 1024,
        input: stdin,
      });
      return { stdout: String(stdout ?? ""), stderr: String(stderr ?? "") };
    } catch (e: any) {
      const stderr = String(e?.stderr ?? "");
      const stdout = String(e?.stdout ?? "");
      const code = e?.code;
      const message = e?.message ?? "pass-cli invocation failed";
      const authCode = classifyPassCliAuthErrorText(
        [stderr, stdout, message].filter(Boolean).join("\n"),
      );
      if (authCode) {
        throw new PassCliAuthError(authCode, stderr || stdout || message);
      }
      throw new Error(
        `pass-cli failed (code=${code ?? "unknown"}): ${message}\n` +
          (stderr ? `stderr:\n${stderr}\n` : "") +
          (stdout ? `stdout:\n${stdout}\n` : ""),
        { cause: e },
      );
    }
  };
}

export const runPassCli = createRunPassCli();

export function asJsonTextOrRaw(text: string): string {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return "";
  try {
    const obj = JSON.parse(trimmed);
    return JSON.stringify(obj, null, 2);
  } catch {
    return trimmed;
  }
}

const DEFAULT_PINNED_PASS_CLI_VERSION = "1.5.2";
const DEFAULT_ITEM_LIST_PAGE_SIZE = 100;
const MAX_ITEM_LIST_PAGE_SIZE = 250;

type Semver = { major: number; minor: number; patch: number };
type CompatibilityStatus = "ok" | "warn" | "error" | "unknown";

type PassCliVersionStatus = {
  pinnedVersion: string;
  detectedVersion: string | null;
  detectedRaw: string;
  compatibilityStatus: CompatibilityStatus;
  reason: string;
};

type PassConnectivityStatus = {
  status: "ok" | "error";
  message: string;
  authErrorCode?: PassCliAuthErrorCode;
  retryable?: boolean;
  userAction?: string;
  authManagedByUser?: boolean;
};

export function parseSemver(text: string): Semver | null {
  const match = (text ?? "").match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);

  if (![major, minor, patch].every((n) => Number.isSafeInteger(n))) {
    return null;
  }

  return { major, minor, patch };
}

export function evaluatePassCliCompatibility(
  detected: Semver,
  pinned: Semver,
): { compatibilityStatus: Exclude<CompatibilityStatus, "unknown">; reason: string } {
  if (detected.major !== pinned.major) {
    return {
      compatibilityStatus: "error",
      reason: `Major version mismatch (detected ${detected.major}, expected ${pinned.major}).`,
    };
  }

  if (detected.minor < pinned.minor) {
    return {
      compatibilityStatus: "error",
      reason: `Detected minor version ${detected.minor} is lower than required ${pinned.minor}.`,
    };
  }

  if (detected.minor > pinned.minor) {
    return {
      compatibilityStatus: "warn",
      reason: `Detected minor version ${detected.minor} is newer than pinned ${pinned.minor}.`,
    };
  }

  if (detected.patch !== pinned.patch) {
    return {
      compatibilityStatus: "warn",
      reason: `Patch version differs (detected ${detected.patch}, pinned ${pinned.patch}).`,
    };
  }

  return {
    compatibilityStatus: "ok",
    reason: "Detected version matches pinned version.",
  };
}

function getPinnedPassCliVersion(): string {
  return process.env.PASS_CLI_PINNED_VERSION || DEFAULT_PINNED_PASS_CLI_VERSION;
}

export async function checkPassCliVersion(passCli: PassCliRunner): Promise<PassCliVersionStatus> {
  const pinnedVersion = getPinnedPassCliVersion();
  const pinnedSemver = parseSemver(pinnedVersion);
  if (!pinnedSemver) {
    return {
      pinnedVersion,
      detectedVersion: null,
      detectedRaw: "",
      compatibilityStatus: "error",
      reason: `Configured pinned version "${pinnedVersion}" is not valid semver.`,
    };
  }

  try {
    const { stdout, stderr } = await passCli(["--version"]);
    const detectedRaw = joinStdoutStderr(stdout, stderr);
    const detectedSemver = parseSemver(detectedRaw);

    if (!detectedSemver) {
      return {
        pinnedVersion,
        detectedVersion: null,
        detectedRaw,
        compatibilityStatus: "unknown",
        reason: "Could not parse semantic version from pass-cli --version output.",
      };
    }

    const { compatibilityStatus, reason } = evaluatePassCliCompatibility(
      detectedSemver,
      pinnedSemver,
    );
    return {
      pinnedVersion,
      detectedVersion: `${detectedSemver.major}.${detectedSemver.minor}.${detectedSemver.patch}`,
      detectedRaw,
      compatibilityStatus,
      reason,
    };
  } catch (error) {
    return {
      pinnedVersion,
      detectedVersion: null,
      detectedRaw: error instanceof Error ? error.message : String(error),
      compatibilityStatus: "error",
      reason: 'Failed to execute "pass-cli --version".',
    };
  }
}

export async function checkPassConnectivity(
  passCli: PassCliRunner,
): Promise<PassConnectivityStatus> {
  try {
    const { stdout, stderr } = await passCli(["test"]);
    const out = joinStdoutStderr(stdout, stderr);
    return {
      status: "ok",
      message: out || "Connection test succeeded.",
    };
  } catch (error) {
    if (error instanceof PassCliAuthError) {
      return {
        status: "error",
        message: error.message,
        authErrorCode: error.code,
        retryable: error.retryable,
        userAction: error.userAction,
        authManagedByUser: true,
      };
    }

    return {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function passCheckStatusHandler(passCli: PassCliRunner) {
  const [version, connectivity] = await Promise.all([
    checkPassCliVersion(passCli),
    checkPassConnectivity(passCli),
  ]);

  const overallStatus: "ok" | "warn" | "error" =
    connectivity.status === "error" || version.compatibilityStatus === "error"
      ? "error"
      : version.compatibilityStatus === "warn" || version.compatibilityStatus === "unknown"
        ? "warn"
        : "ok";

  const structuredContent: Record<string, unknown> = {
    overall_status: overallStatus,
    connectivity,
    version,
  };

  if (connectivity.authErrorCode) {
    structuredContent.error_code = connectivity.authErrorCode;
    structuredContent.retryable = connectivity.retryable ?? true;
    structuredContent.user_action = connectivity.userAction;
    structuredContent.auth_managed_by_user = true;
  }

  const summary = [
    `Overall status: ${overallStatus.toUpperCase()}`,
    `Connectivity: ${connectivity.status.toUpperCase()} - ${connectivity.message}`,
    `Version compatibility: ${version.compatibilityStatus.toUpperCase()} - ${version.reason}`,
    `Pinned version: ${version.pinnedVersion}`,
    `Detected version: ${version.detectedVersion ?? "unknown"}${
      version.detectedRaw ? ` (${version.detectedRaw})` : ""
    }`,
  ].join("\n");

  return {
    ...(overallStatus === "error" ? { isError: true as const } : {}),
    content: [{ type: "text" as const, text: summary }],
    structuredContent,
  };
}

function parseCursor(cursor?: string): number {
  if (!cursor) return 0;
  if (!/^\d+$/.test(cursor)) {
    throw new Error('Invalid cursor. Expected a non-negative integer string (example: "100").');
  }

  const parsed = Number(cursor);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error("Invalid cursor. Value is too large.");
  }
  return parsed;
}

export function requireWriteGate(confirm?: boolean) {
  if (process.env.ALLOW_WRITE !== "1") {
    throw new Error("Write operations are disabled. Set ALLOW_WRITE=1 to enable.");
  }
  if (confirm !== true) {
    throw new Error('Write operation requires explicit confirmation: set {"confirm": true}.');
  }
}

export const passVaultListInputSchema = z.object({
  output: z.enum(["json", "human"]).default("json"),
});

export const passUserInfoInputSchema = z.object({
  output: z.enum(["json", "human"]).default("json"),
});

export const passItemListInputSchema = z.object({
  vaultName: z.string().optional(),
  shareId: z.string().optional(),
  pageSize: z.number().int().min(1).max(MAX_ITEM_LIST_PAGE_SIZE).optional(),
  cursor: z.string().optional(),
  output: z.enum(["json", "human"]).default("json"),
});

export const passItemViewInputSchema = z.object({
  uri: z.string().optional(),
  shareId: z.string().optional(),
  vaultName: z.string().optional(),
  itemId: z.string().optional(),
  itemTitle: z.string().optional(),
  field: z.string().optional(),
  output: z.enum(["json", "human"]).default("json"),
});

export const passVaultCreateInputSchema = z.object({
  name: z.string(),
  confirm: z.boolean().optional(),
});

export const passVaultUpdateInputSchema = z.object({
  shareId: z.string().optional(),
  vaultName: z.string().optional(),
  newName: z.string(),
  confirm: z.boolean().optional(),
});

export const passVaultDeleteInputSchema = z.object({
  shareId: z.string().optional(),
  vaultName: z.string().optional(),
  confirm: z.boolean().optional(),
});

export const passItemCreateLoginInputSchema = z.object({
  shareId: z.string().optional(),
  vaultName: z.string().optional(),
  title: z.string(),
  username: z.string().optional(),
  email: z.string().optional(),
  password: z.string().optional(),
  url: z.string().optional(),
  generatePassword: z.string().optional(),
  output: z.enum(["json", "human"]).default("json"),
  confirm: z.boolean().optional(),
});

export const passItemCreateFromTemplateInputSchema = z.object({
  itemType: z.string(),
  shareId: z.string().optional(),
  vaultName: z.string().optional(),
  templateJson: z.string(),
  output: z.enum(["json", "human"]).default("json"),
  confirm: z.boolean().optional(),
});

export const passItemUpdateInputSchema = z.object({
  shareId: z.string().optional(),
  vaultName: z.string().optional(),
  itemId: z.string().optional(),
  itemTitle: z.string().optional(),
  fields: z.array(z.string()).min(1),
  confirm: z.boolean().optional(),
});

export const passItemDeleteInputSchema = z.object({
  shareId: z.string(),
  itemId: z.string(),
  confirm: z.boolean().optional(),
});

export type PassVaultListInput = z.infer<typeof passVaultListInputSchema>;
export type PassUserInfoInput = z.infer<typeof passUserInfoInputSchema>;
export type PassItemListInput = z.infer<typeof passItemListInputSchema>;
export type PassItemViewInput = z.infer<typeof passItemViewInputSchema>;
export type PassVaultCreateInput = z.infer<typeof passVaultCreateInputSchema>;
export type PassVaultUpdateInput = z.infer<typeof passVaultUpdateInputSchema>;
export type PassVaultDeleteInput = z.infer<typeof passVaultDeleteInputSchema>;
export type PassItemCreateLoginInput = z.infer<typeof passItemCreateLoginInputSchema>;
export type PassItemCreateFromTemplateInput = z.infer<typeof passItemCreateFromTemplateInputSchema>;
export type PassItemUpdateInput = z.infer<typeof passItemUpdateInputSchema>;
export type PassItemDeleteInput = z.infer<typeof passItemDeleteInputSchema>;

export async function passInfoHandler(passCli: PassCliRunner) {
  const { stdout } = await passCli(["info"]);
  return asTextContent(stdout.trim());
}

export async function passUserInfoHandler(passCli: PassCliRunner, { output }: PassUserInfoInput) {
  const { stdout } = await passCli(["user", "info", "--output", output]);
  return asTextContent(asJsonTextOrRaw(stdout));
}

export async function passVaultListHandler(passCli: PassCliRunner, { output }: PassVaultListInput) {
  const { stdout } = await passCli(["vault", "list", "--output", output]);
  return asTextContent(asJsonTextOrRaw(stdout));
}

export async function passItemListHandler(
  passCli: PassCliRunner,
  { vaultName, shareId, pageSize, cursor, output }: PassItemListInput,
) {
  if (vaultName && shareId) throw new Error("Provide only one of vaultName or shareId.");
  if (output !== "json" && (pageSize !== undefined || cursor !== undefined)) {
    throw new Error('Pagination is supported only with {"output":"json"}.');
  }

  const args = ["item", "list", "--output", output];
  if (shareId) args.splice(2, 0, "--share-id", shareId);
  else if (vaultName) args.splice(2, 0, vaultName);

  const { stdout } = await passCli(args);
  if (output !== "json") {
    return asTextContent(asJsonTextOrRaw(stdout));
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return asTextContent(asJsonTextOrRaw(stdout));
  }

  if (!Array.isArray(parsed)) {
    return asTextContent(asJsonTextOrRaw(stdout));
  }

  const start = parseCursor(cursor);
  const size = pageSize ?? DEFAULT_ITEM_LIST_PAGE_SIZE;
  const end = start + size;
  const items = parsed.slice(start, end);
  const nextCursor = end < parsed.length ? String(end) : undefined;

  const structuredContent = {
    items,
    pageSize: size,
    cursor: String(start),
    returned: items.length,
    total: parsed.length,
    nextCursor,
  };

  return {
    content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
  };
}

export async function passItemViewHandler(passCli: PassCliRunner, input: PassItemViewInput) {
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
    args.push("--output", output, uri);
  } else {
    if (shareId) args.push("--share-id", shareId);
    else args.push("--vault-name", vaultName!);

    if (itemId) args.push("--item-id", itemId);
    else args.push("--item-title", itemTitle!);

    if (field) args.push("--field", field);
    args.push("--output", output);
  }

  const { stdout } = await passCli(args);
  return asTextContent(asJsonTextOrRaw(stdout));
}

export async function passVaultCreateHandler(
  passCli: PassCliRunner,
  { name, confirm }: PassVaultCreateInput,
) {
  requireWriteGate(confirm);
  const { stdout, stderr } = await passCli(["vault", "create", "--name", name]);
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(out || "OK");
}

export async function passVaultUpdateHandler(
  passCli: PassCliRunner,
  { shareId, vaultName, newName, confirm }: PassVaultUpdateInput,
) {
  requireWriteGate(confirm);
  if (!!shareId === !!vaultName) throw new Error("Provide exactly one of shareId or vaultName.");
  const args = ["vault", "update"];
  if (shareId) args.push("--share-id", shareId);
  else args.push("--vault-name", vaultName!);
  args.push("--name", newName);
  const { stdout, stderr } = await passCli(args);
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(out || "OK");
}

export async function passVaultDeleteHandler(
  passCli: PassCliRunner,
  { shareId, vaultName, confirm }: PassVaultDeleteInput,
) {
  requireWriteGate(confirm);
  if (!!shareId === !!vaultName) throw new Error("Provide exactly one of shareId or vaultName.");
  const args = ["vault", "delete"];
  if (shareId) args.push("--share-id", shareId);
  else args.push("--vault-name", vaultName!);
  const { stdout, stderr } = await passCli(args);
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(out || "OK");
}

export async function passItemCreateLoginHandler(
  passCli: PassCliRunner,
  input: PassItemCreateLoginInput,
) {
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

  const { stdout, stderr } = await passCli(args);
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(asJsonTextOrRaw(out));
}

export async function passItemCreateFromTemplateHandler(
  passCli: PassCliRunner,
  input: PassItemCreateFromTemplateInput,
) {
  requireWriteGate(input.confirm);
  if (input.shareId && input.vaultName)
    throw new Error("Provide only one of shareId or vaultName.");

  const args: string[] = ["item", "create", input.itemType, "--from-template", "-"];
  if (input.shareId) args.push("--share-id", input.shareId);
  else if (input.vaultName) args.push("--vault-name", input.vaultName);

  args.push("--output", input.output);

  const { stdout, stderr } = await passCli(args, input.templateJson);
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(asJsonTextOrRaw(out));
}

export async function passItemUpdateHandler(
  passCli: PassCliRunner,
  { shareId, vaultName, itemId, itemTitle, fields, confirm }: PassItemUpdateInput,
) {
  requireWriteGate(confirm);
  if (shareId && vaultName) throw new Error("Provide only one of shareId or vaultName.");
  if (itemId && itemTitle) throw new Error("Provide only one of itemId or itemTitle.");
  if (!itemId && !itemTitle) throw new Error("Provide itemId or itemTitle.");

  const args: string[] = ["item", "update"];
  if (shareId) args.push("--share-id", shareId);
  else if (vaultName) args.push("--vault-name", vaultName);

  if (itemId) args.push("--item-id", itemId);
  else args.push("--item-title", itemTitle!);

  for (const field of fields) args.push("--field", field);

  const { stdout, stderr } = await passCli(args);
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(out || "OK");
}

export async function passItemDeleteHandler(
  passCli: PassCliRunner,
  { shareId, itemId, confirm }: PassItemDeleteInput,
) {
  requireWriteGate(confirm);
  const { stdout, stderr } = await passCli([
    "item",
    "delete",
    "--share-id",
    shareId,
    "--item-id",
    itemId,
  ]);
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(out || "OK");
}

export function createServer(deps: { runPassCli?: PassCliRunner } = {}) {
  const passCli = deps.runPassCli ?? runPassCli;
  const server = new McpServer({
    name: "proton-pass-cli",
    version: "0.0.1",
  });

  server.registerTool(
    "view_session_info",
    {},
    withAuthErrorHandling(async () => passInfoHandler(passCli)),
  );

  server.registerTool("check_status", {}, async () => passCheckStatusHandler(passCli));

  server.registerTool(
    "view_user_info",
    {
      inputSchema: passUserInfoInputSchema,
    },
    withAuthErrorHandling(async (input) => passUserInfoHandler(passCli, input)),
  );

  server.registerTool(
    "list_vaults",
    {
      inputSchema: passVaultListInputSchema,
    },
    withAuthErrorHandling(async (input) => passVaultListHandler(passCli, input)),
  );

  server.registerTool(
    "list_items",
    {
      inputSchema: passItemListInputSchema,
    },
    withAuthErrorHandling(async (input) => passItemListHandler(passCli, input)),
  );

  server.registerTool(
    "view_item",
    {
      inputSchema: passItemViewInputSchema,
    },
    withAuthErrorHandling(async (input) => passItemViewHandler(passCli, input)),
  );

  server.registerTool(
    "create_vault",
    { inputSchema: passVaultCreateInputSchema },
    withAuthErrorHandling(async (input) => passVaultCreateHandler(passCli, input)),
  );

  server.registerTool(
    "update_vault",
    {
      inputSchema: passVaultUpdateInputSchema,
    },
    withAuthErrorHandling(async (input) => passVaultUpdateHandler(passCli, input)),
  );

  server.registerTool(
    "delete_vault",
    {
      inputSchema: passVaultDeleteInputSchema,
    },
    withAuthErrorHandling(async (input) => passVaultDeleteHandler(passCli, input)),
  );

  server.registerTool(
    "create_login_item",
    {
      inputSchema: passItemCreateLoginInputSchema,
    },
    withAuthErrorHandling(async (input) => passItemCreateLoginHandler(passCli, input)),
  );

  server.registerTool(
    "create_item_from_template",
    {
      inputSchema: passItemCreateFromTemplateInputSchema,
    },
    withAuthErrorHandling(async (input) => passItemCreateFromTemplateHandler(passCli, input)),
  );

  server.registerTool(
    "update_item",
    {
      inputSchema: passItemUpdateInputSchema,
    },
    withAuthErrorHandling(async (input) => passItemUpdateHandler(passCli, input)),
  );

  server.registerTool(
    "delete_item",
    {
      inputSchema: passItemDeleteInputSchema,
    },
    withAuthErrorHandling(async (input) => passItemDeleteHandler(passCli, input)),
  );

  return server;
}

export async function startServer(
  options: {
    server?: Pick<McpServer, "connect">;
    transport?: StdioServerTransport;
    onStarted?: (message: string) => void;
  } = {},
) {
  const server = options.server ?? createServer();
  const transport = options.transport ?? new StdioServerTransport();
  await server.connect(transport);
  const onStarted = options.onStarted ?? logErr;
  onStarted("started");
}
