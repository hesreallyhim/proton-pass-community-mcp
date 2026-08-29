import { execFile } from "node:child_process";

import { classifyPassCliAuthErrorText, PassCliAuthError } from "./errors.js";
import {
  FORMAT_OUTPUT_COMMAND_PREFIXES,
  PATH_OUTPUT_COMMAND_PREFIXES,
} from "./output-policy.generated.js";

export type PassCliResult = { stdout: string; stderr: string };
export type PassCliInvocationOptions = { agentReason?: string };
export type PassCliRunner = (
  args: string[],
  stdin?: string,
  options?: PassCliInvocationOptions,
) => Promise<PassCliResult>;

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
const MAX_AGENT_REASON_LENGTH = 300;
type OutputSemantics = "none" | "format" | "path";

const execFileWithInput: ExecFileAsyncLike = (file, args, { input, ...options }) =>
  new Promise((resolve, reject) => {
    let stdinError: Error | undefined;
    const child = execFile(file, args, options, (error, stdout, stderr) => {
      const failure = error ?? stdinError;
      if (failure) reject(Object.assign(failure, { stdout, stderr }));
      else resolve({ stdout, stderr });
    });

    const failInput = (error: Error) => {
      stdinError = error;
      child.kill("SIGKILL");
    };
    child.stdin?.once("error", failInput);
    try {
      // Async execFile has no `input` option. Always end the pipe, even without input.
      child.stdin?.end(input);
    } catch (error) {
      failInput(error as Error);
    }
  });

function invocationEnvironment(options?: PassCliInvocationOptions): NodeJS.ProcessEnv {
  const env = { ...process.env };
  const reason = options?.agentReason;
  if (reason === undefined) return env;
  if (!reason.trim()) throw new Error("agentReason must not be empty or whitespace-only.");
  if (Array.from(reason).length > MAX_AGENT_REASON_LENGTH) {
    throw new Error(
      `agentReason must contain at most ${MAX_AGENT_REASON_LENGTH} Unicode code points.`,
    );
  }
  env.PROTON_PASS_AGENT_REASON = reason;
  return env;
}

/**
 * Output-policy prefixes are generated from:
 * 1) `src/pass-cli/command-catalog.ts` (wrapped command inventory)
 * 2) `src/pass-cli/output-policy.json` (declarative semantics by command key)
 *
 * Regeneration workflow:
 * - `npm run pass:dev:output-policy:update`
 * - `npm run pass:dev:output-policy:check`
 */
type CommandOutputPolicy = {
  prefix: readonly string[];
  semantics: OutputSemantics;
};

const COMMAND_OUTPUT_POLICIES: readonly CommandOutputPolicy[] = [
  ...PATH_OUTPUT_COMMAND_PREFIXES.map((prefix) => ({ prefix, semantics: "path" as const })),
  ...FORMAT_OUTPUT_COMMAND_PREFIXES.map((prefix) => ({ prefix, semantics: "format" as const })),
].sort((a, b) => b.prefix.length - a.prefix.length);

// Required-value flags emitted by existing tool handlers. Valueless flags and
// optional --generate-password are excluded; --output depends on its command.
const NAMED_VALUE_FLAGS = new Set([
  "--attachment-id",
  "--capitalize",
  "--cardholder-name",
  "--count",
  "--cvv",
  "--email",
  "--env-file",
  "--expiration-date",
  "--field",
  "--file-mode",
  "--filter-state",
  "--filter-type",
  "--from-share-id",
  "--from-template",
  "--from-vault-name",
  "--in-file",
  "--item-id",
  "--item-title",
  "--length",
  "--member-share-id",
  "--name",
  "--note",
  "--number",
  "--numbers",
  "--only-items",
  "--only-vaults",
  "--out-file",
  "--password",
  "--pin",
  "--prefix",
  "--role",
  "--separator",
  "--share-id",
  "--sort-by",
  "--symbols",
  "--title",
  "--to-share-id",
  "--to-vault-name",
  "--uppercase",
  "--url",
  "--username",
  "--vault-name",
]);

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

function isNamedValueFlag(flag: string, semantics: OutputSemantics): boolean {
  return NAMED_VALUE_FLAGS.has(flag) || (flag === "--output" && semantics === "path");
}

function bindNamedOptionValues(args: readonly string[], semantics: OutputSemantics): string[] {
  const bound: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === "--") return [...bound, ...args.slice(index)];

    const value = args[index + 1];
    if (value === undefined || !isNamedValueFlag(flag, semantics)) {
      bound.push(flag);
      continue;
    }

    // A known flag consumes its value, including a literal "--". Binding makes
    // Clap and our output normalizer treat a leading hyphen as data, not a flag.
    if (value.startsWith("-")) bound.push(`${flag}=${value}`);
    else bound.push(flag, value);
    index += 1;
  }
  return bound;
}

function isOutputFormatValue(value: string | undefined): boolean {
  return value === "json" || value === "human";
}

function stripOutputFlag(args: readonly string[], mode: "all" | "format-only"): string[] {
  const terminatorIndex = args.indexOf("--");
  const optionEnd = terminatorIndex === -1 ? args.length : terminatorIndex;
  const next: string[] = [];

  for (let i = 0; i < optionEnd; i += 1) {
    const token = args[i];
    if (token !== "--output") {
      next.push(token);
      continue;
    }

    const value = args[i + 1];
    const hasValue = i + 1 < optionEnd;
    const removePair = mode === "all" || !hasValue || isOutputFormatValue(value);
    if (removePair) {
      if (hasValue) i += 1;
      continue;
    }

    next.push(token);
  }

  return [...next, ...args.slice(optionEnd)];
}

function insertBeforeTerminator(args: readonly string[], suffix: readonly string[]): string[] {
  const terminatorIndex = args.indexOf("--");
  if (terminatorIndex === -1) return [...args, ...suffix];
  return [...args.slice(0, terminatorIndex), ...suffix, ...args.slice(terminatorIndex)];
}

export function normalizePassCliArgs(args: readonly string[]): string[] {
  const semantics = resolveOutputSemantics(args);
  const boundArgs = bindNamedOptionValues(args, semantics);
  if (semantics === "path") return boundArgs;
  if (semantics === "none") return stripOutputFlag(boundArgs, "format-only");

  const withoutOutput = stripOutputFlag(boundArgs, "all");
  return insertBeforeTerminator(withoutOutput, ["--output", "json"]);
}

function passCliInvocationError(error: any): Error {
  const stderr = String(error?.stderr ?? "");
  const stdout = String(error?.stdout ?? "");
  const code = error?.code;
  const message = error?.message ?? "pass-cli invocation failed";
  const authCode = classifyPassCliAuthErrorText(
    [stderr, stdout, message].filter(Boolean).join("\n"),
  );
  if (authCode) {
    return new PassCliAuthError(authCode, stderr || stdout || message);
  }
  return new Error(
    `pass-cli failed (code=${code ?? "unknown"}): ${sanitizeCliOutput(message)}\n` +
      (stderr ? `stderr:\n${sanitizeCliOutput(stderr)}\n` : "") +
      (stdout ? `stdout:\n${sanitizeCliOutput(stdout)}\n` : ""),
    { cause: error },
  );
}

export function createRunPassCli(
  execFileImpl: ExecFileAsyncLike = execFileWithInput,
): PassCliRunner {
  return async (args, stdin, options): Promise<PassCliResult> => {
    const cmd = process.env.PASS_CLI_BIN || "pass-cli";
    const normalizedArgs = normalizePassCliArgs(args);
    const env = invocationEnvironment(options);
    try {
      const { stdout, stderr } = await execFileImpl(cmd, normalizedArgs, {
        env,
        maxBuffer: 10 * 1024 * 1024,
        input: stdin,
      });
      return { stdout: String(stdout ?? ""), stderr: String(stderr ?? "") };
    } catch (error) {
      throw passCliInvocationError(error);
    }
  };
}

export const runPassCli = createRunPassCli();
