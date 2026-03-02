import { z } from "zod";

import { asJsonTextOrRaw, asTextContent } from "../pass-cli/output.js";
import type { PassCliRunner } from "../pass-cli/runner.js";

export const listSharesInputSchema = z.object({
  onlyItems: z.boolean().optional(),
  onlyVaults: z.boolean().optional(),
  output: z.enum(["json", "human"]).default("json"),
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
