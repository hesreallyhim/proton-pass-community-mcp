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

export function sanitizeCliOutput(text: string, maxLen = MAX_ERROR_OUTPUT_LENGTH): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return trimmed.slice(0, maxLen) + `\n... (truncated, ${trimmed.length - maxLen} chars omitted)`;
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
        `pass-cli failed (code=${code ?? "unknown"}): ${sanitizeCliOutput(message)}\n` +
          (stderr ? `stderr:\n${sanitizeCliOutput(stderr)}\n` : "") +
          (stdout ? `stdout:\n${sanitizeCliOutput(stdout)}\n` : ""),
        { cause: e },
      );
    }
  };
}

export const runPassCli = createRunPassCli();
