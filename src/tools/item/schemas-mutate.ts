import { z } from "zod";

import { confirmInput } from "../shared/schema-fragments.js";

export const moveItemInputSchema = z
  .object({
    fromShareId: z.string().max(100).optional().describe("Source share ID"),
    fromVaultName: z.string().max(255).optional().describe("Source vault name"),
    toShareId: z.string().max(100).optional().describe("Destination share ID"),
    toVaultName: z.string().max(255).optional().describe("Destination vault name"),
    itemId: z.string().max(100).optional().describe("Item ID to move"),
    itemTitle: z.string().max(255).optional().describe("Item title to move"),
    confirm: confirmInput,
  })
  .refine((input) => Boolean(input.fromShareId) !== Boolean(input.fromVaultName), {
    message: "Provide exactly one of fromShareId or fromVaultName.",
  })
  .refine((input) => Boolean(input.toShareId) !== Boolean(input.toVaultName), {
    message: "Provide exactly one of toShareId or toVaultName.",
  })
  .refine((input) => Boolean(input.itemId) !== Boolean(input.itemTitle), {
    message: "Provide exactly one of itemId or itemTitle.",
  });

export const updateItemInputSchema = z.object({
  shareId: z.string().max(100).optional().describe("Share ID containing the item"),
  vaultName: z.string().max(255).optional().describe("Vault name containing the item"),
  itemId: z.string().max(100).optional().describe("Item ID to update"),
  itemTitle: z.string().max(255).optional().describe("Item title to update"),
  fields: z.array(z.string().max(1024)).min(1).describe("Fields to update (key=value pairs)"),
  confirm: confirmInput,
});

export const trashItemInputSchema = z
  .object({
    shareId: z.string().max(100).optional().describe("Share ID containing the item"),
    vaultName: z.string().max(255).optional().describe("Vault name containing the item"),
    itemId: z.string().max(100).optional().describe("Item ID to trash"),
    itemTitle: z.string().max(255).optional().describe("Item title to trash"),
    confirm: confirmInput,
  })
  .refine((input) => !(input.shareId && input.vaultName), {
    message: "Provide only one of shareId or vaultName.",
  })
  .refine((input) => Boolean(input.itemId) !== Boolean(input.itemTitle), {
    message: "Provide exactly one of itemId or itemTitle.",
  });

export const untrashItemInputSchema = z
  .object({
    shareId: z.string().max(100).optional().describe("Share ID containing the item"),
    vaultName: z.string().max(255).optional().describe("Vault name containing the item"),
    itemId: z.string().max(100).optional().describe("Item ID to restore"),
    itemTitle: z.string().max(255).optional().describe("Item title to restore"),
    confirm: confirmInput,
  })
  .refine((input) => !(input.shareId && input.vaultName), {
    message: "Provide only one of shareId or vaultName.",
  })
  .refine((input) => Boolean(input.itemId) !== Boolean(input.itemTitle), {
    message: "Provide exactly one of itemId or itemTitle.",
  });

export const downloadItemAttachmentInputSchema = z.object({
  shareId: z.string().max(100).describe("Share ID containing the item"),
  itemId: z.string().max(100).describe("Item ID containing the attachment"),
  attachmentId: z.string().max(100).describe("Attachment ID to download"),
  outputPath: z.string().min(1).max(4096).describe("Output path for downloaded attachment"),
  confirm: confirmInput,
});

export const deleteItemInputSchema = z.object({
  shareId: z.string().max(100).describe("Share ID containing the item to delete"),
  itemId: z.string().max(100).describe("Item ID to delete"),
  confirm: confirmInput,
});

export type MoveItemInput = z.infer<typeof moveItemInputSchema>;
export type UpdateItemInput = z.infer<typeof updateItemInputSchema>;
export type TrashItemInput = z.infer<typeof trashItemInputSchema>;
export type UntrashItemInput = z.infer<typeof untrashItemInputSchema>;
export type DownloadItemAttachmentInput = z.infer<typeof downloadItemAttachmentInputSchema>;
export type DeleteItemInput = z.infer<typeof deleteItemInputSchema>;
