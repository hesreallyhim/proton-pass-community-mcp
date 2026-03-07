import { asJsonTextOrRaw, asTextContent, joinStdoutStderr } from "../pass-cli/output.js";
import type { PassCliRunner } from "../pass-cli/runner.js";
import { appendOptionalScopeArgs } from "./item-handler-helpers.js";
import type {
  CreateCreditCardItemInput,
  CreateCustomItemInput,
  CreateIdentityItemInput,
  CreateItemAliasInput,
  CreateLoginItemFromTemplateInput,
  CreateLoginItemInput,
  CreateNoteItemInput,
  CreateWifiItemInput,
} from "./item-schemas-create.js";
import { requireWriteGate } from "./write-gate.js";

export async function createLoginItemHandler(passCli: PassCliRunner, input: CreateLoginItemInput) {
  requireWriteGate(input.confirm);

  const args: string[] = ["item", "create", "login"];
  appendOptionalScopeArgs(args, input.shareId, input.vaultName);
  args.push("--title", input.title);

  if (input.username) args.push("--username", input.username);
  if (input.email) args.push("--email", input.email);
  if (input.password) args.push("--password", input.password);
  if (input.url) args.push("--url", input.url);

  if (input.generatePassword) {
    if (input.generatePassword === "true") args.push("--generate-password");
    else args.push(`--generate-password=${input.generatePassword}`);
  }

  args.push("--output", input.output);

  const { stdout, stderr } = await passCli(args);
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(asJsonTextOrRaw(out));
}

export async function createLoginItemFromTemplateHandler(
  passCli: PassCliRunner,
  input: CreateLoginItemFromTemplateInput,
) {
  requireWriteGate(input.confirm);

  const args: string[] = ["item", "create", "login", "--from-template", "-"];
  appendOptionalScopeArgs(args, input.shareId, input.vaultName);
  args.push("--output", input.output);

  const { stdout, stderr } = await passCli(args, JSON.stringify(input.template));
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(asJsonTextOrRaw(out));
}

export async function createNoteItemHandler(passCli: PassCliRunner, input: CreateNoteItemInput) {
  requireWriteGate(input.confirm);

  const args: string[] = ["item", "create", "note"];
  appendOptionalScopeArgs(args, input.shareId, input.vaultName);
  args.push("--title", input.title);
  if (input.note !== undefined) args.push("--note", input.note);

  const { stdout, stderr } = await passCli(args);
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(asJsonTextOrRaw(out));
}

export async function createCreditCardItemHandler(
  passCli: PassCliRunner,
  input: CreateCreditCardItemInput,
) {
  requireWriteGate(input.confirm);

  const args: string[] = ["item", "create", "credit-card"];
  appendOptionalScopeArgs(args, input.shareId, input.vaultName);

  args.push("--title", input.title);
  if (input.cardholderName !== undefined) args.push("--cardholder-name", input.cardholderName);
  if (input.number !== undefined) args.push("--number", input.number);
  if (input.cvv !== undefined) args.push("--cvv", input.cvv);
  if (input.expirationDate !== undefined) args.push("--expiration-date", input.expirationDate);
  if (input.pin !== undefined) args.push("--pin", input.pin);
  if (input.note !== undefined) args.push("--note", input.note);

  const { stdout, stderr } = await passCli(args);
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(asJsonTextOrRaw(out));
}

export async function createWifiItemHandler(passCli: PassCliRunner, input: CreateWifiItemInput) {
  requireWriteGate(input.confirm);

  const args: string[] = ["item", "create", "wifi"];
  appendOptionalScopeArgs(args, input.shareId, input.vaultName);
  args.push("--title", input.title, "--ssid", input.ssid);
  if (input.password !== undefined) args.push("--password", input.password);
  if (input.security !== undefined) args.push("--security", input.security);
  if (input.note !== undefined) args.push("--note", input.note);

  const { stdout, stderr } = await passCli(args);
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(asJsonTextOrRaw(out));
}

export async function createCustomItemHandler(
  passCli: PassCliRunner,
  input: CreateCustomItemInput,
) {
  requireWriteGate(input.confirm);

  const args: string[] = ["item", "create", "custom", "--from-template", "-"];
  appendOptionalScopeArgs(args, input.shareId, input.vaultName);

  const { stdout, stderr } = await passCli(args, JSON.stringify(input.template));
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(asJsonTextOrRaw(out));
}

export async function createIdentityItemHandler(
  passCli: PassCliRunner,
  input: CreateIdentityItemInput,
) {
  requireWriteGate(input.confirm);

  const args: string[] = ["item", "create", "identity", "--from-template", "-"];
  appendOptionalScopeArgs(args, input.shareId, input.vaultName);

  const { stdout, stderr } = await passCli(args, JSON.stringify(input.template));
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(asJsonTextOrRaw(out));
}

export async function createItemAliasHandler(
  passCli: PassCliRunner,
  { shareId, vaultName, prefix, output, confirm }: CreateItemAliasInput,
) {
  requireWriteGate(confirm);

  const args = ["item", "alias", "create"];
  appendOptionalScopeArgs(args, shareId, vaultName);
  args.push("--prefix", prefix, "--output", output);

  const { stdout, stderr } = await passCli(args);
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(asJsonTextOrRaw(out));
}
