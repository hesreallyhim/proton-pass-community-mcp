import { asJsonTextOrRaw, asTextContent } from "../pass-cli/output.js";
import type { PassCliRunner } from "../pass-cli/runner.js";
import { buildViewLikeArgs } from "./item-handler-helpers.js";
import type { ItemTotpInput, ViewItemInput } from "./item-schemas-view.js";

export async function viewItemHandler(passCli: PassCliRunner, input: ViewItemInput) {
  const args = buildViewLikeArgs("view", input);
  const { stdout } = await passCli(args);
  return asTextContent(asJsonTextOrRaw(stdout));
}

export async function itemTotpHandler(passCli: PassCliRunner, input: ItemTotpInput) {
  const args = buildViewLikeArgs("totp", input);
  const { stdout } = await passCli(args);
  return asTextContent(asJsonTextOrRaw(stdout));
}
