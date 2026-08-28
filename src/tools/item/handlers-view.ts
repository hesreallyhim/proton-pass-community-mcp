import { asJsonTextOrRaw, asTextContent } from "../../pass-cli/output.js";
import type { PassCliRunner } from "../../pass-cli/runner.js";
import { invokeWithAgentReason } from "../shared/agent-reason.js";
import { buildViewLikeArgs } from "./handler-helpers.js";
import type { ItemTotpInput, ViewItemInput } from "./schemas-view.js";

function formatViewOutput(stdout: string, input: ViewItemInput | ItemTotpInput): string {
  const fieldInUri = input.uri?.slice("pass://".length).split("/").length ?? 0;
  if (input.field || fieldInUri > 2) {
    // Rust println! appends one LF; all preceding bytes belong to the field value.
    return stdout.endsWith("\n") ? stdout.slice(0, -1) : stdout;
  }
  return asJsonTextOrRaw(stdout);
}

export async function viewItemHandler(passCli: PassCliRunner, input: ViewItemInput) {
  const args = buildViewLikeArgs("view", input);
  const { stdout } = await invokeWithAgentReason(passCli, args, input.agentReason);
  return asTextContent(formatViewOutput(stdout, input));
}

export async function itemTotpHandler(passCli: PassCliRunner, input: ItemTotpInput) {
  const args = buildViewLikeArgs("totp", input);
  const { stdout } = await invokeWithAgentReason(passCli, args, input.agentReason);
  return asTextContent(formatViewOutput(stdout, input));
}
