import { z } from "zod";

import { asJsonTextOrRaw, asTextContent, asWriteResult } from "../pass-cli/output.js";
import type { PassCliRunner } from "../pass-cli/runner.js";
import { asRecord, firstString } from "./item-utils.js";
import { extractArrayFromParsed, paginateRefs } from "./pagination.js";
import { confirmInput } from "./schema-fragments.js";
import { appendScopeArgs, scopeRefinement } from "./scope.js";
import { requireWriteGate } from "./write-gate.js";

const DEFAULT_VAULT_MEMBER_PAGE_SIZE = 100;
const MAX_VAULT_MEMBER_PAGE_SIZE = 250;

export const listVaultsInputSchema = z.object({
  output: z.enum(["json", "human"]).default("json").describe("Output format"),
});

export const listVaultMembersInputSchema = z
  .object({
    shareId: z.string().max(100).optional().describe("Share ID of the vault"),
    vaultName: z.string().max(255).optional().describe("Name of the vault"),
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(MAX_VAULT_MEMBER_PAGE_SIZE)
      .optional()
      .describe("Number of members per page (1-250, default 100)"),
    cursor: z
      .string()
      .max(20)
      .optional()
      .describe("Pagination cursor from a previous response's nextCursor"),
  })
  .refine(scopeRefinement.check, { message: scopeRefinement.message });

export const createVaultInputSchema = z.object({
  name: z.string().max(255).describe("Name for the new vault"),
  confirm: confirmInput,
});

const VAULT_MEMBER_ROLE_OPTIONS = ["viewer", "editor", "manager"] as const;

export const updateVaultInputSchema = z.object({
  shareId: z.string().max(100).optional().describe("Share ID of the vault to update"),
  vaultName: z.string().max(255).optional().describe("Name of the vault to update"),
  newName: z.string().max(255).describe("New name for the vault"),
  confirm: confirmInput,
});

export const deleteVaultInputSchema = z.object({
  shareId: z.string().max(100).optional().describe("Share ID of the vault to delete"),
  vaultName: z.string().max(255).optional().describe("Name of the vault to delete"),
  confirm: confirmInput,
});

export const shareVaultInputSchema = z
  .object({
    shareId: z.string().max(100).optional().describe("Share ID of the vault to share"),
    vaultName: z.string().max(255).optional().describe("Name of the vault to share"),
    email: z.string().email().max(320).describe("Email of the user to invite"),
    role: z.enum(VAULT_MEMBER_ROLE_OPTIONS).optional().describe("Role for the invited user"),
    confirm: confirmInput,
  })
  .refine(scopeRefinement.check, { message: scopeRefinement.message });

export const updateVaultMemberInputSchema = z
  .object({
    shareId: z.string().max(100).optional().describe("Share ID of the vault"),
    vaultName: z.string().max(255).optional().describe("Name of the vault"),
    memberShareId: z.string().max(100).describe("Member share ID to update"),
    role: z.enum(VAULT_MEMBER_ROLE_OPTIONS).describe("Role to assign"),
    confirm: confirmInput,
  })
  .refine(scopeRefinement.check, { message: scopeRefinement.message });

export const transferVaultInputSchema = z
  .object({
    shareId: z.string().max(100).optional().describe("Share ID of the vault"),
    vaultName: z.string().max(255).optional().describe("Name of the vault"),
    memberShareId: z.string().max(100).describe("Member share ID that will become owner"),
    confirm: confirmInput,
  })
  .refine(scopeRefinement.check, { message: scopeRefinement.message });

export const removeVaultMemberInputSchema = z
  .object({
    shareId: z.string().max(100).optional().describe("Share ID of the vault"),
    vaultName: z.string().max(255).optional().describe("Name of the vault"),
    memberShareId: z.string().max(100).describe("Member share ID to remove"),
    confirm: confirmInput,
  })
  .refine(scopeRefinement.check, { message: scopeRefinement.message });

export type ListVaultsInput = z.infer<typeof listVaultsInputSchema>;
export type ListVaultMembersInput = z.infer<typeof listVaultMembersInputSchema>;
export type CreateVaultInput = z.infer<typeof createVaultInputSchema>;
export type UpdateVaultInput = z.infer<typeof updateVaultInputSchema>;
export type DeleteVaultInput = z.infer<typeof deleteVaultInputSchema>;
export type ShareVaultInput = z.infer<typeof shareVaultInputSchema>;
export type UpdateVaultMemberInput = z.infer<typeof updateVaultMemberInputSchema>;
export type TransferVaultInput = z.infer<typeof transferVaultInputSchema>;
export type RemoveVaultMemberInput = z.infer<typeof removeVaultMemberInputSchema>;

export type VaultMemberRef = {
  id: string;
  username: string | null;
  email: string | null;
  role: string | null;
  state: string | null;
  create_time: string | null;
};

function toVaultMemberRef(rawMember: unknown, index: number): VaultMemberRef {
  const member = asRecord(rawMember);
  if (!member) {
    const fallbackId = `member-${index + 1}`;
    return {
      id: fallbackId,
      username: null,
      email: null,
      role: null,
      state: null,
      create_time: null,
    };
  }

  const id =
    firstString(member, ["member_share_id", "member_id", "id", "share_id", "user_id"]) ??
    `member-${index + 1}`;

  return {
    id,
    username: firstString(member, ["username", "member_name", "name", "display_name"]),
    email: firstString(member, ["email", "member_email", "user_email"]),
    role: firstString(member, ["role", "share_role"]),
    state: firstString(member, ["state", "status"]),
    create_time: firstString(member, ["create_time", "created_at", "invite_time"]),
  };
}

export async function listVaultsHandler(passCli: PassCliRunner, { output }: ListVaultsInput) {
  const { stdout } = await passCli(["vault", "list", "--output", output]);
  return asTextContent(asJsonTextOrRaw(stdout));
}

export async function listVaultMembersHandler(
  passCli: PassCliRunner,
  { shareId, vaultName, pageSize, cursor }: ListVaultMembersInput,
) {
  const args = ["vault", "member", "list"];
  appendScopeArgs(args, { shareId, vaultName });
  args.push("--output", "json");

  const { stdout } = await passCli(args);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return asTextContent(asJsonTextOrRaw(stdout));
  }

  const rawMembers = extractArrayFromParsed(parsed, [
    "members",
    "vault_members",
    "users",
    "items",
    "results",
  ]);
  if (!rawMembers) {
    return asTextContent(asJsonTextOrRaw(stdout));
  }
  const refs = rawMembers.map((member, index) => toVaultMemberRef(member, index));
  const page = paginateRefs(refs, cursor, pageSize, DEFAULT_VAULT_MEMBER_PAGE_SIZE);

  const structuredContent = {
    scope: shareId ? { shareId } : { vaultName: vaultName! },
    ...page,
  };

  return {
    content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
  };
}

export async function createVaultHandler(
  passCli: PassCliRunner,
  { name, confirm }: CreateVaultInput,
) {
  requireWriteGate(confirm);
  const { stdout, stderr } = await passCli(["vault", "create", "--name", name]);
  return asWriteResult(stdout, stderr);
}

export async function updateVaultHandler(
  passCli: PassCliRunner,
  { shareId, vaultName, newName, confirm }: UpdateVaultInput,
) {
  requireWriteGate(confirm);
  const args = ["vault", "update"];
  appendScopeArgs(args, { shareId, vaultName });
  args.push("--name", newName);
  const { stdout, stderr } = await passCli(args);
  return asWriteResult(stdout, stderr);
}

export async function shareVaultHandler(
  passCli: PassCliRunner,
  { shareId, vaultName, email, role, confirm }: ShareVaultInput,
) {
  requireWriteGate(confirm);
  const args = ["vault", "share"];
  appendScopeArgs(args, { shareId, vaultName });
  args.push(email);
  if (role) args.push("--role", role);
  const { stdout, stderr } = await passCli(args);
  return asWriteResult(stdout, stderr);
}

export async function deleteVaultHandler(
  passCli: PassCliRunner,
  { shareId, vaultName, confirm }: DeleteVaultInput,
) {
  requireWriteGate(confirm);
  const args = ["vault", "delete"];
  appendScopeArgs(args, { shareId, vaultName });
  const { stdout, stderr } = await passCli(args);
  return asWriteResult(stdout, stderr);
}

export async function updateVaultMemberHandler(
  passCli: PassCliRunner,
  { shareId, vaultName, memberShareId, role, confirm }: UpdateVaultMemberInput,
) {
  requireWriteGate(confirm);
  const args = ["vault", "member", "update"];
  appendScopeArgs(args, { shareId, vaultName });
  args.push("--member-share-id", memberShareId, "--role", role);
  const { stdout, stderr } = await passCli(args);
  return asWriteResult(stdout, stderr);
}

export async function removeVaultMemberHandler(
  passCli: PassCliRunner,
  { shareId, vaultName, memberShareId, confirm }: RemoveVaultMemberInput,
) {
  requireWriteGate(confirm);
  const args = ["vault", "member", "remove"];
  appendScopeArgs(args, { shareId, vaultName });
  args.push("--member-share-id", memberShareId);
  const { stdout, stderr } = await passCli(args);
  return asWriteResult(stdout, stderr);
}

export async function transferVaultHandler(
  passCli: PassCliRunner,
  { shareId, vaultName, memberShareId, confirm }: TransferVaultInput,
) {
  requireWriteGate(confirm);
  const args = ["vault", "transfer"];
  appendScopeArgs(args, { shareId, vaultName });
  args.push(memberShareId);
  const { stdout, stderr } = await passCli(args);
  return asWriteResult(stdout, stderr);
}
