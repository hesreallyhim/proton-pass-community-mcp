import { z } from "zod";

import { asJsonTextOrRaw, asTextContent } from "../pass-cli/output.js";
import type { PassCliRunner } from "../pass-cli/runner.js";

export const viewUserInfoInputSchema = z.object({
  output: z.enum(["json", "human"]).default("json").describe("Output format"),
});

export type ViewUserInfoInput = z.infer<typeof viewUserInfoInputSchema>;

export async function viewSessionInfoHandler(passCli: PassCliRunner) {
  const { stdout } = await passCli(["info"]);
  return asTextContent(stdout.trim());
}

export async function viewUserInfoHandler(passCli: PassCliRunner, { output }: ViewUserInfoInput) {
  const { stdout } = await passCli(["user", "info", "--output", output]);
  return asTextContent(asJsonTextOrRaw(stdout));
}
