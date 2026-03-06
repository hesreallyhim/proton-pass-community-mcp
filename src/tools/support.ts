import { asTextContent } from "../pass-cli/output.js";
import type { PassCliRunner } from "../pass-cli/runner.js";

export async function supportHandler(passCli: PassCliRunner) {
  const { stdout } = await passCli(["support"]);
  return asTextContent(stdout.trim());
}
