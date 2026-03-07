import { z } from "zod";

import { SHARE_ROLE_OPTIONS } from "./constants.js";
import { confirmInput } from "../shared/schema-fragments.js";

export const shareItemInputSchema = z.object({
  shareId: z.string().max(100).describe("Share ID containing the item"),
  itemId: z.string().max(100).describe("Item ID to share"),
  email: z.string().email().max(320).describe("Email of the user to invite"),
  role: z.enum(SHARE_ROLE_OPTIONS).optional().describe("Role for the invited user"),
  confirm: confirmInput,
});

export const listItemMembersInputSchema = z.object({
  shareId: z.string().max(100).describe("Share ID containing the item"),
  itemId: z.string().max(100).describe("Item ID"),
  output: z.enum(["json", "human"]).default("json").describe("Output format"),
});

export const updateItemMemberInputSchema = z.object({
  shareId: z.string().max(100).describe("Share ID containing the item"),
  memberShareId: z.string().max(100).describe("Member share ID"),
  role: z.enum(SHARE_ROLE_OPTIONS).describe("Role for the member"),
  confirm: confirmInput,
});

export const removeItemMemberInputSchema = z.object({
  shareId: z.string().max(100).describe("Share ID containing the item"),
  memberShareId: z.string().max(100).describe("Member share ID"),
  confirm: confirmInput,
});

export type ShareItemInput = z.infer<typeof shareItemInputSchema>;
export type ListItemMembersInput = z.infer<typeof listItemMembersInputSchema>;
export type UpdateItemMemberInput = z.infer<typeof updateItemMemberInputSchema>;
export type RemoveItemMemberInput = z.infer<typeof removeItemMemberInputSchema>;
