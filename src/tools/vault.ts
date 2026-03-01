import { z } from "zod";

import { asJsonTextOrRaw, asTextContent, joinStdoutStderr } from "../pass-cli/output.js";
import type { PassCliRunner } from "../pass-cli/runner.js";
import { requireWriteGate } from "./write-gate.js";

export const passVaultListInputSchema = z.object({
  output: z.enum(["json", "human"]).default("json"),
});

export const passVaultCreateInputSchema = z.object({
  name: z.string(),
  confirm: z.boolean().optional(),
});

export const passVaultUpdateInputSchema = z.object({
  shareId: z.string().optional(),
  vaultName: z.string().optional(),
  newName: z.string(),
  confirm: z.boolean().optional(),
});

export const passVaultDeleteInputSchema = z.object({
  shareId: z.string().optional(),
  vaultName: z.string().optional(),
  confirm: z.boolean().optional(),
});

export type PassVaultListInput = z.infer<typeof passVaultListInputSchema>;
export type PassVaultCreateInput = z.infer<typeof passVaultCreateInputSchema>;
export type PassVaultUpdateInput = z.infer<typeof passVaultUpdateInputSchema>;
export type PassVaultDeleteInput = z.infer<typeof passVaultDeleteInputSchema>;

export async function passVaultListHandler(passCli: PassCliRunner, { output }: PassVaultListInput) {
  const { stdout } = await passCli(["vault", "list", "--output", output]);
  return asTextContent(asJsonTextOrRaw(stdout));
}

export async function passVaultCreateHandler(
  passCli: PassCliRunner,
  { name, confirm }: PassVaultCreateInput,
) {
  requireWriteGate(confirm);
  const { stdout, stderr } = await passCli(["vault", "create", "--name", name]);
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(out || "OK");
}

export async function passVaultUpdateHandler(
  passCli: PassCliRunner,
  { shareId, vaultName, newName, confirm }: PassVaultUpdateInput,
) {
  requireWriteGate(confirm);
  if (!!shareId === !!vaultName) throw new Error("Provide exactly one of shareId or vaultName.");
  const args = ["vault", "update"];
  if (shareId) args.push("--share-id", shareId);
  else args.push("--vault-name", vaultName!);
  args.push("--name", newName);
  const { stdout, stderr } = await passCli(args);
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(out || "OK");
}

export async function passVaultDeleteHandler(
  passCli: PassCliRunner,
  { shareId, vaultName, confirm }: PassVaultDeleteInput,
) {
  requireWriteGate(confirm);
  if (!!shareId === !!vaultName) throw new Error("Provide exactly one of shareId or vaultName.");
  const args = ["vault", "delete"];
  if (shareId) args.push("--share-id", shareId);
  else args.push("--vault-name", vaultName!);
  const { stdout, stderr } = await passCli(args);
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(out || "OK");
}
