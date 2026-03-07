import { asJsonTextOrRaw, asTextContent, asWriteResult } from "../pass-cli/output.js";
import type { PassCliRunner } from "../pass-cli/runner.js";
import { extractArrayFromParsed, paginateRefs } from "./pagination.js";
import { appendScopeArgs } from "./scope.js";
import { DEFAULT_VAULT_MEMBER_PAGE_SIZE } from "./vault-constants.js";
import { toVaultMemberRef } from "./vault-refs.js";
import type {
  CreateVaultInput,
  DeleteVaultInput,
  ListVaultMembersInput,
  ListVaultsInput,
  RemoveVaultMemberInput,
  ShareVaultInput,
  TransferVaultInput,
  UpdateVaultInput,
  UpdateVaultMemberInput,
} from "./vault-schemas.js";
import { requireWriteGate } from "./write-gate.js";

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
