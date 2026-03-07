import { z } from "zod";

export const viewItemInputSchema = z.object({
  uri: z.string().max(1024).optional().describe("Item URI (e.g. pass://<shareId>/<itemId>)"),
  shareId: z.string().max(100).optional().describe("Share ID containing the item"),
  vaultName: z.string().max(255).optional().describe("Vault name containing the item"),
  itemId: z.string().max(100).optional().describe("Item ID to view"),
  itemTitle: z.string().max(255).optional().describe("Item title to view"),
  field: z.string().max(100).optional().describe("Specific field to extract from the item"),
  output: z.enum(["json", "human"]).default("json").describe("Output format"),
});

export const itemTotpInputSchema = z.object({
  uri: z
    .string()
    .max(1024)
    .optional()
    .describe("Item URI (e.g. pass://<shareId>/<itemId>/<field>)"),
  shareId: z.string().max(100).optional().describe("Share ID containing the item"),
  vaultName: z.string().max(255).optional().describe("Vault name containing the item"),
  itemId: z.string().max(100).optional().describe("Item ID to generate TOTP for"),
  itemTitle: z.string().max(255).optional().describe("Item title to generate TOTP for"),
  field: z.string().max(100).optional().describe("Specific TOTP field to extract"),
  output: z.enum(["json", "human"]).default("json").describe("Output format"),
});

export type ViewItemInput = z.infer<typeof viewItemInputSchema>;
export type ItemTotpInput = z.infer<typeof itemTotpInputSchema>;
