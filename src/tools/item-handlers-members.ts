import { asJsonTextOrRaw, asTextContent, asWriteResult } from "../pass-cli/output.js";
import type { PassCliRunner } from "../pass-cli/runner.js";
import type {
  ListItemMembersInput,
  RemoveItemMemberInput,
  ShareItemInput,
  UpdateItemMemberInput,
} from "./item-schemas-members.js";
import { requireWriteGate } from "./write-gate.js";

export async function shareItemHandler(
  passCli: PassCliRunner,
  { shareId, itemId, email, role, confirm }: ShareItemInput,
) {
  requireWriteGate(confirm);
  const args = ["item", "share", "--share-id", shareId, "--item-id", itemId, email];
  if (role) args.push("--role", role);
  const { stdout, stderr } = await passCli(args);
  return asWriteResult(stdout, stderr);
}

export async function listItemMembersHandler(
  passCli: PassCliRunner,
  { shareId, itemId, output }: ListItemMembersInput,
) {
  const { stdout } = await passCli([
    "item",
    "member",
    "list",
    "--share-id",
    shareId,
    "--item-id",
    itemId,
    "--output",
    output,
  ]);
  return asTextContent(asJsonTextOrRaw(stdout));
}

export async function updateItemMemberHandler(
  passCli: PassCliRunner,
  { shareId, memberShareId, role, confirm }: UpdateItemMemberInput,
) {
  requireWriteGate(confirm);
  const { stdout, stderr } = await passCli([
    "item",
    "member",
    "update",
    "--share-id",
    shareId,
    "--member-share-id",
    memberShareId,
    "--role",
    role,
  ]);
  return asWriteResult(stdout, stderr);
}

export async function removeItemMemberHandler(
  passCli: PassCliRunner,
  { shareId, memberShareId, confirm }: RemoveItemMemberInput,
) {
  requireWriteGate(confirm);
  const { stdout, stderr } = await passCli([
    "item",
    "member",
    "remove",
    "--share-id",
    shareId,
    "--member-share-id",
    memberShareId,
  ]);
  return asWriteResult(stdout, stderr);
}
