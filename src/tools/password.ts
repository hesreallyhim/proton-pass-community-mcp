import { z } from "zod";

import { asJsonTextOrRaw, asTextContent } from "../pass-cli/output.js";
import type { PassCliRunner } from "../pass-cli/runner.js";

export const generateRandomPasswordInputSchema = z.object({
  length: z.number().int().min(1).max(1024).optional().describe("Password length"),
  numbers: z.boolean().optional().describe("Include numbers"),
  uppercase: z.boolean().optional().describe("Include uppercase characters"),
  symbols: z.boolean().optional().describe("Include symbols"),
});

export const generatePassphraseInputSchema = z.object({
  count: z.number().int().min(1).max(1024).optional().describe("Number of words"),
  separator: z.string().max(64).optional().describe("Word separator"),
  capitalize: z.boolean().optional().describe("Capitalize each word"),
  numbers: z.boolean().optional().describe("Include numbers"),
});

export const scorePasswordInputSchema = z.object({
  password: z.string().min(1).max(4096).describe("Password to score"),
  output: z.enum(["json", "human"]).default("json").describe("Output format"),
});

export type GenerateRandomPasswordInput = z.infer<typeof generateRandomPasswordInputSchema>;
export type GeneratePassphraseInput = z.infer<typeof generatePassphraseInputSchema>;
export type ScorePasswordInput = z.infer<typeof scorePasswordInputSchema>;

export async function generateRandomPasswordHandler(
  passCli: PassCliRunner,
  { length, numbers, uppercase, symbols }: GenerateRandomPasswordInput,
) {
  const args = ["password", "generate", "random"];
  if (length !== undefined) args.push("--length", String(length));
  if (numbers !== undefined) args.push("--numbers", String(numbers));
  if (uppercase !== undefined) args.push("--uppercase", String(uppercase));
  if (symbols !== undefined) args.push("--symbols", String(symbols));

  const { stdout } = await passCli(args);
  return asTextContent(stdout.trim());
}

export async function generatePassphraseHandler(
  passCli: PassCliRunner,
  { count, separator, capitalize, numbers }: GeneratePassphraseInput,
) {
  const args = ["password", "generate", "passphrase"];
  if (count !== undefined) args.push("--count", String(count));
  if (separator !== undefined) args.push("--separator", separator);
  if (capitalize !== undefined) args.push("--capitalize", String(capitalize));
  if (numbers !== undefined) args.push("--numbers", String(numbers));

  const { stdout } = await passCli(args);
  return asTextContent(stdout.trim());
}

export async function scorePasswordHandler(
  passCli: PassCliRunner,
  { password, output }: ScorePasswordInput,
) {
  const { stdout } = await passCli(["password", "score", password, "--output", output]);
  return asTextContent(asJsonTextOrRaw(stdout));
}
