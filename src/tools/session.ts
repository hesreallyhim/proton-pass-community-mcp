import { z } from "zod";

import { asJsonTextOrRaw, asTextContent } from "../pass-cli/output.js";
import type { PassCliRunner } from "../pass-cli/runner.js";

export const passUserInfoInputSchema = z.object({
  output: z.enum(["json", "human"]).default("json"),
});

export type PassUserInfoInput = z.infer<typeof passUserInfoInputSchema>;

export async function passInfoHandler(passCli: PassCliRunner) {
  const { stdout } = await passCli(["info"]);
  return asTextContent(stdout.trim());
}

export async function passUserInfoHandler(passCli: PassCliRunner, { output }: PassUserInfoInput) {
  const { stdout } = await passCli(["user", "info", "--output", output]);
  return asTextContent(asJsonTextOrRaw(stdout));
}
