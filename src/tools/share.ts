import { z } from "zod";

import { asJsonTextOrRaw, asTextContent } from "../pass-cli/output.js";
import type { PassCliRunner } from "../pass-cli/runner.js";

export const listSharesInputSchema = z.object({
  onlyItems: z.boolean().optional().describe("Return only item shares"),
  onlyVaults: z.boolean().optional().describe("Return only vault shares"),
  output: z.enum(["json", "human"]).default("json").describe("Output format"),
});

export type ListSharesInput = z.infer<typeof listSharesInputSchema>;

export async function listSharesHandler(passCli: PassCliRunner, input: ListSharesInput) {
  const { onlyItems, onlyVaults, output } = input;
  if (onlyItems && onlyVaults) {
    throw new Error("onlyItems and onlyVaults are mutually exclusive.");
  }

  const args = ["share", "list", "--output", output];
  if (onlyItems) args.push("--items");
  if (onlyVaults) args.push("--vaults");

  const { stdout } = await passCli(args);
  return asTextContent(asJsonTextOrRaw(stdout));
}
