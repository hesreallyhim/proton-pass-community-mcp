import { z } from "zod";

import { asJsonTextOrRaw, asTextContent, joinStdoutStderr } from "../pass-cli/output.js";
import type { PassCliRunner } from "../pass-cli/runner.js";
import { requireWriteGate } from "./write-gate.js";

export const listVaultsInputSchema = z.object({
  output: z.enum(["json", "human"]).default("json").describe("Output format"),
});

export const createVaultInputSchema = z.object({
  name: z.string().max(255).describe("Name for the new vault"),
  confirm: z.boolean().optional().describe("Must be true to execute the write operation"),
});

export const updateVaultInputSchema = z.object({
  shareId: z.string().max(100).optional().describe("Share ID of the vault to update"),
  vaultName: z.string().max(255).optional().describe("Name of the vault to update"),
  newName: z.string().max(255).describe("New name for the vault"),
  confirm: z.boolean().optional().describe("Must be true to execute the write operation"),
});

export const deleteVaultInputSchema = z.object({
  shareId: z.string().max(100).optional().describe("Share ID of the vault to delete"),
  vaultName: z.string().max(255).optional().describe("Name of the vault to delete"),
  confirm: z.boolean().optional().describe("Must be true to execute the write operation"),
});

export type ListVaultsInput = z.infer<typeof listVaultsInputSchema>;
export type CreateVaultInput = z.infer<typeof createVaultInputSchema>;
export type UpdateVaultInput = z.infer<typeof updateVaultInputSchema>;
export type DeleteVaultInput = z.infer<typeof deleteVaultInputSchema>;

export async function listVaultsHandler(passCli: PassCliRunner, { output }: ListVaultsInput) {
  const { stdout } = await passCli(["vault", "list", "--output", output]);
  return asTextContent(asJsonTextOrRaw(stdout));
}

export async function createVaultHandler(
  passCli: PassCliRunner,
  { name, confirm }: CreateVaultInput,
) {
  requireWriteGate(confirm);
  const { stdout, stderr } = await passCli(["vault", "create", "--name", name]);
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(out || "OK");
}

export async function updateVaultHandler(
  passCli: PassCliRunner,
  { shareId, vaultName, newName, confirm }: UpdateVaultInput,
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

export async function deleteVaultHandler(
  passCli: PassCliRunner,
  { shareId, vaultName, confirm }: DeleteVaultInput,
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
