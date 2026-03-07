import { asWriteResult } from "../pass-cli/output.js";
import type { PassCliRunner } from "../pass-cli/runner.js";
import { appendOptionalScopeArgs, appendRequiredItemSelectorArgs } from "./item-handler-helpers.js";
import type {
  DeleteItemInput,
  DownloadItemAttachmentInput,
  MoveItemInput,
  TrashItemInput,
  UntrashItemInput,
  UpdateItemInput,
} from "./item-schemas-mutate.js";
import { requireWriteGate } from "./write-gate.js";

export async function moveItemHandler(passCli: PassCliRunner, input: MoveItemInput) {
  requireWriteGate(input.confirm);

  const hasFromShareId = Boolean(input.fromShareId);
  const hasFromVaultName = Boolean(input.fromVaultName);
  if (hasFromShareId === hasFromVaultName) {
    throw new Error("Provide exactly one of fromShareId or fromVaultName.");
  }

  const hasToShareId = Boolean(input.toShareId);
  const hasToVaultName = Boolean(input.toVaultName);
  if (hasToShareId === hasToVaultName) {
    throw new Error("Provide exactly one of toShareId or toVaultName.");
  }

  const hasItemId = Boolean(input.itemId);
  const hasItemTitle = Boolean(input.itemTitle);
  if (hasItemId === hasItemTitle) {
    throw new Error("Provide exactly one of itemId or itemTitle.");
  }

  const args = ["item", "move"];
  if (input.fromShareId) args.push("--from-share-id", input.fromShareId);
  else args.push("--from-vault-name", input.fromVaultName!);

  if (input.itemId) args.push("--item-id", input.itemId);
  else args.push("--item-title", input.itemTitle!);

  if (input.toShareId) args.push("--to-share-id", input.toShareId);
  else args.push("--to-vault-name", input.toVaultName!);

  const { stdout, stderr } = await passCli(args);
  return asWriteResult(stdout, stderr);
}

export async function updateItemHandler(
  passCli: PassCliRunner,
  { shareId, vaultName, itemId, itemTitle, fields, confirm }: UpdateItemInput,
) {
  requireWriteGate(confirm);

  const args: string[] = ["item", "update"];
  appendOptionalScopeArgs(args, shareId, vaultName);
  appendRequiredItemSelectorArgs(args, itemId, itemTitle);
  for (const field of fields) args.push("--field", field);

  const { stdout, stderr } = await passCli(args);
  return asWriteResult(stdout, stderr);
}

export async function trashItemHandler(
  passCli: PassCliRunner,
  { shareId, vaultName, itemId, itemTitle, confirm }: TrashItemInput,
) {
  requireWriteGate(confirm);

  const args: string[] = ["item", "trash"];
  appendOptionalScopeArgs(args, shareId, vaultName);
  appendRequiredItemSelectorArgs(args, itemId, itemTitle);

  const { stdout, stderr } = await passCli(args);
  return asWriteResult(stdout, stderr);
}

export async function untrashItemHandler(
  passCli: PassCliRunner,
  { shareId, vaultName, itemId, itemTitle, confirm }: UntrashItemInput,
) {
  requireWriteGate(confirm);

  const args: string[] = ["item", "untrash"];
  appendOptionalScopeArgs(args, shareId, vaultName);
  appendRequiredItemSelectorArgs(args, itemId, itemTitle);

  const { stdout, stderr } = await passCli(args);
  return asWriteResult(stdout, stderr);
}

export async function downloadItemAttachmentHandler(
  passCli: PassCliRunner,
  { shareId, itemId, attachmentId, outputPath, confirm }: DownloadItemAttachmentInput,
) {
  requireWriteGate(confirm);

  const { stdout, stderr } = await passCli([
    "item",
    "attachment",
    "download",
    "--share-id",
    shareId,
    "--item-id",
    itemId,
    "--attachment-id",
    attachmentId,
    "--output",
    outputPath,
  ]);
  return asWriteResult(stdout, stderr);
}

export async function deleteItemHandler(
  passCli: PassCliRunner,
  { shareId, itemId, confirm }: DeleteItemInput,
) {
  requireWriteGate(confirm);

  const { stdout, stderr } = await passCli([
    "item",
    "delete",
    "--share-id",
    shareId,
    "--item-id",
    itemId,
  ]);
  return asWriteResult(stdout, stderr);
}
