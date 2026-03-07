import { z } from "zod";

import { confirmInput } from "./schema-fragments.js";
import { scopeRefinement } from "./scope.js";
import { MAX_VAULT_MEMBER_PAGE_SIZE, VAULT_MEMBER_ROLE_OPTIONS } from "./vault-constants.js";

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
