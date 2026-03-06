import { z } from "zod";

import { asJsonTextOrRaw, asTextContent } from "../pass-cli/output.js";
import type { PassCliRunner } from "../pass-cli/runner.js";

export const generateTotpInputSchema = z.object({
  secretOrUri: z.string().min(1).max(4096).describe("TOTP secret (base32) or otpauth:// URI"),
  output: z.enum(["json", "human"]).default("json").describe("Output format"),
});

export type GenerateTotpInput = z.infer<typeof generateTotpInputSchema>;

export async function generateTotpHandler(
  passCli: PassCliRunner,
  { secretOrUri, output }: GenerateTotpInput,
) {
  const { stdout } = await passCli(["totp", "generate", secretOrUri, "--output", output]);
  return asTextContent(asJsonTextOrRaw(stdout));
}
