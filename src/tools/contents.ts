import { z } from "zod";

import { asTextContent, joinStdoutStderr } from "../pass-cli/output.js";
import type { PassCliRunner } from "../pass-cli/runner.js";
import { requireWriteGate } from "./write-gate.js";

export const injectInputSchema = z.object({
  inFile: z.string().min(1).max(4096).describe("Path to template input file"),
  outFile: z.string().min(1).max(4096).optional().describe("Optional output file path"),
  fileMode: z
    .string()
    .regex(/^[0-7]{3,4}$/)
    .optional()
    .describe("Unix file mode (e.g. 0600)"),
  force: z.boolean().optional().describe("Overwrite output file if it exists"),
  confirm: z.boolean().optional().describe("Must be true to execute the write operation"),
});

export const runInputSchema = z.object({
  command: z.array(z.string().min(1).max(4096)).min(1).describe("Command and arguments to run"),
  envFiles: z
    .array(z.string().min(1).max(4096))
    .max(50)
    .optional()
    .describe("dotenv files to load in order"),
  noMasking: z.boolean().optional().describe("Disable output masking of secret values"),
  confirm: z.boolean().optional().describe("Must be true to execute the write operation"),
});

export type InjectInput = z.infer<typeof injectInputSchema>;
export type RunInput = z.infer<typeof runInputSchema>;

export async function injectHandler(
  passCli: PassCliRunner,
  { inFile, outFile, fileMode, force, confirm }: InjectInput,
) {
  requireWriteGate(confirm);
  const args = ["inject", "--in-file", inFile];
  if (outFile) args.push("--out-file", outFile);
  if (fileMode) args.push("--file-mode", fileMode);
  if (force) args.push("--force");
  const { stdout, stderr } = await passCli(args);
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(out || "OK");
}

export async function runHandler(
  passCli: PassCliRunner,
  { command, envFiles, noMasking, confirm }: RunInput,
) {
  requireWriteGate(confirm);
  const args = ["run"];
  for (const envFile of envFiles ?? []) {
    args.push("--env-file", envFile);
  }
  if (noMasking) args.push("--no-masking");
  args.push("--", ...command);

  const { stdout, stderr } = await passCli(args);
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(out || "OK");
}
