import { vi } from "vitest";

import type { PassCliResult, PassCliRunner } from "../../src/server.js";

const originalAllowWrite = process.env.ALLOW_WRITE;
const originalPassCliBin = process.env.PASS_CLI_BIN;

export function restoreProcessEnvAndMocks() {
  if (originalAllowWrite === undefined) delete process.env.ALLOW_WRITE;
  else process.env.ALLOW_WRITE = originalAllowWrite;

  if (originalPassCliBin === undefined) delete process.env.PASS_CLI_BIN;
  else process.env.PASS_CLI_BIN = originalPassCliBin;

  vi.restoreAllMocks();
}

export function makeRunner(
  output:
    | PassCliResult
    | ((args: string[], stdin?: string) => PassCliResult | Promise<PassCliResult>) = {
    stdout: "",
    stderr: "",
  },
) {
  const fn = vi.fn<PassCliRunner>(async (args, stdin) => {
    if (typeof output === "function") return await output(args, stdin);
    return output;
  });
  return fn;
}
