import { z } from "zod";

import type { PassCliRunner } from "../../pass-cli/runner.js";

export const agentReasonInput = z
  .string()
  .refine((value) => value.trim().length > 0, "agentReason must not be empty or whitespace-only")
  .refine(
    (value) => Array.from(value).length <= 300,
    "agentReason must be at most 300 Unicode characters",
  )
  .describe("Purpose of this operation, required for agent sessions; never include secrets");

export function invokeWithAgentReason(
  passCli: PassCliRunner,
  args: string[],
  agentReason: string | undefined,
  stdin?: string,
) {
  const reason = agentReasonInput.optional().parse(agentReason);
  if (reason !== undefined) return passCli(args, stdin, { agentReason: reason });
  return stdin === undefined ? passCli(args) : passCli(args, stdin);
}
