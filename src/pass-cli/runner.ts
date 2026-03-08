import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { classifyPassCliAuthErrorText, PassCliAuthError } from "./errors.js";

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

const MAX_ERROR_OUTPUT_LENGTH = 500;
type OutputSemantics = "none" | "format" | "path";

/**
 * Output-flag policy table for wrapped pass-cli subcommands.
 *
 * Why this exists:
 * - Not every pass-cli subcommand accepts "--output".
 * - For commands that do accept output *format*, MCP policy is to enforce JSON.
 * - Some commands use "--output" for a different meaning (for example file path),
 *   which must be preserved and never rewritten as a format flag.
 *
 * Semantics:
 * - "format": command accepts "--output {human|json}" -> runner enforces "--output json".
 * - "path": command uses "--output <path>" -> runner leaves args untouched.
 * - "none": command does not support output format -> runner strips only accidental
 *   "--output human|json" pairs.
 *
 * Maintenance:
 * - Keep this table aligned with the project baseline pass-cli version.
 * - When adding/changing a wrapped command, confirm semantics from
 *   `pass-cli <subcommand> --help` and update the prefixes below.
 * - The helper tests in `test/server/helpers.test.ts` must be updated with any table changes.
 */
const FORMAT_OUTPUT_COMMAND_PREFIXES: readonly (readonly string[])[] = [
  ["info"],
  ["user", "info"],
  ["invite", "list"],
  ["password", "generate", "random"],
  ["password", "generate", "passphrase"],
  ["password", "score"],
  ["totp", "generate"],
  ["share", "list"],
  ["vault", "list"],
  ["vault", "member", "list"],
  ["item", "list"],
  ["item", "view"],
  ["item", "totp"],
  ["item", "alias", "create"],
  ["item", "member", "list"],
];

const PATH_OUTPUT_COMMAND_PREFIXES: readonly (readonly string[])[] = [
  ["item", "attachment", "download"],
];

type CommandOutputPolicy = {
  prefix: readonly string[];
  semantics: OutputSemantics;
};

const COMMAND_OUTPUT_POLICIES: readonly CommandOutputPolicy[] = [
  ...PATH_OUTPUT_COMMAND_PREFIXES.map((prefix) => ({ prefix, semantics: "path" as const })),
  ...FORMAT_OUTPUT_COMMAND_PREFIXES.map((prefix) => ({ prefix, semantics: "format" as const })),
].sort((a, b) => b.prefix.length - a.prefix.length);

export function sanitizeCliOutput(text: string, maxLen = MAX_ERROR_OUTPUT_LENGTH): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return trimmed.slice(0, maxLen) + `\n... (truncated, ${trimmed.length - maxLen} chars omitted)`;
}

function startsWithCommandPrefix(args: readonly string[], prefix: readonly string[]): boolean {
  if (args.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i += 1) {
    if (args[i] !== prefix[i]) return false;
  }
  return true;
}

function resolveOutputSemantics(args: readonly string[]): OutputSemantics {
  for (const policy of COMMAND_OUTPUT_POLICIES) {
    if (startsWithCommandPrefix(args, policy.prefix)) return policy.semantics;
  }
  return "none";
}

function isOutputFormatValue(value: string | undefined): boolean {
  return value === "json" || value === "human";
}

function stripOutputFlag(args: readonly string[], mode: "all" | "format-only"): string[] {
  const next: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token !== "--output") {
      next.push(token);
      continue;
    }

    const value = args[i + 1];
    const hasValue = i + 1 < args.length;
    const removePair =
      mode === "all" || !hasValue || (mode === "format-only" && isOutputFormatValue(value));
    if (removePair) {
      if (hasValue) i += 1;
      continue;
    }

    next.push(token);
  }

  return next;
}

function insertBeforeTerminator(args: readonly string[], suffix: readonly string[]): string[] {
  const terminatorIndex = args.indexOf("--");
  if (terminatorIndex === -1) return [...args, ...suffix];
  return [...args.slice(0, terminatorIndex), ...suffix, ...args.slice(terminatorIndex)];
}

export function normalizePassCliArgs(args: readonly string[]): string[] {
  const semantics = resolveOutputSemantics(args);
  if (semantics === "path") return [...args];
  if (semantics === "none") return stripOutputFlag(args, "format-only");

  const withoutOutput = stripOutputFlag(args, "all");
  return insertBeforeTerminator(withoutOutput, ["--output", "json"]);
}

export function createRunPassCli(
  execFileImpl: ExecFileAsyncLike = execFileAsync as ExecFileAsyncLike,
) {
  return async (args: string[], stdin?: string): Promise<PassCliResult> => {
    const cmd = process.env.PASS_CLI_BIN || "pass-cli";
    const normalizedArgs = normalizePassCliArgs(args);
    try {
      const { stdout, stderr } = await execFileImpl(cmd, normalizedArgs, {
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
        `pass-cli failed (code=${code ?? "unknown"}): ${sanitizeCliOutput(message)}\n` +
          (stderr ? `stderr:\n${sanitizeCliOutput(stderr)}\n` : "") +
          (stdout ? `stdout:\n${sanitizeCliOutput(stdout)}\n` : ""),
        { cause: e },
      );
    }
  };
}

export const runPassCli = createRunPassCli();
