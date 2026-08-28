import { z } from "zod";

import { asTextContent, asWriteResult } from "../pass-cli/output.js";
import type { PassCliRunner } from "../pass-cli/runner.js";
import { invokeWithAgentReason, agentReasonInput } from "./shared/agent-reason.js";
import { confirmInput } from "./shared/schema-fragments.js";
import { requireWriteGate } from "./shared/write-gate.js";

export const injectInputSchema = z.object({
  agentReason: agentReasonInput.optional(),
  inFile: z.string().min(1).max(4096).describe("Path to template input file"),
  outFile: z.string().min(1).max(4096).optional().describe("Optional output file path"),
  fileMode: z
    .string()
    .regex(/^[0-7]{3,4}$/)
    .optional()
    .describe("Unix file mode (e.g. 0600)"),
  force: z.boolean().optional().describe("Overwrite output file if it exists"),
  confirm: confirmInput,
});

export const runInputSchema = z.object({
  agentReason: agentReasonInput.optional(),
  command: z.array(z.string().min(1).max(4096)).min(1).describe("Command and arguments to run"),
  envFiles: z
    .array(z.string().min(1).max(4096))
    .max(50)
    .optional()
    .describe("dotenv files to load in order"),
  noMasking: z.boolean().optional().describe("Disable output masking of secret values"),
  confirm: confirmInput,
});

export type InjectInput = z.infer<typeof injectInputSchema>;
export type RunInput = z.infer<typeof runInputSchema>;

export async function injectHandler(
  passCli: PassCliRunner,
  { inFile, outFile, fileMode, force, confirm, agentReason }: InjectInput,
) {
  requireWriteGate(confirm);
  const args = ["inject", "--in-file", inFile];
  if (outFile) args.push("--out-file", outFile);
  // pass-cli interprets a mode without a leading zero as decimal.
  if (fileMode) args.push("--file-mode", fileMode.startsWith("0") ? fileMode : `0${fileMode}`);
  if (force) args.push("--force");
  const { stdout, stderr } = await invokeWithAgentReason(passCli, args, agentReason);
  return outFile ? asWriteResult(stdout, stderr) : asTextContent(stdout);
}

export async function runHandler(
  passCli: PassCliRunner,
  { command, envFiles, noMasking, confirm, agentReason }: RunInput,
) {
  requireWriteGate(confirm);
  const args = ["run"];
  for (const envFile of envFiles ?? []) {
    args.push("--env-file", envFile);
  }
  if (noMasking) args.push("--no-masking");
  args.push("--", ...command);

  const { stdout, stderr } = await invokeWithAgentReason(passCli, args, agentReason);
  return asWriteResult(stdout, stderr);
}
