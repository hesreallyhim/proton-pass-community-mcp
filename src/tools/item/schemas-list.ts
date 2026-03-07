import { z } from "zod";

import {
  CURSOR_DESCRIPTION,
  FILTER_STATE_DESCRIPTION,
  FILTER_TYPE_DESCRIPTION,
  ITEM_FILTER_STATES,
  ITEM_FILTER_TYPES,
  ITEM_SORT_OPTIONS,
  MAX_ITEM_LIST_PAGE_SIZE,
  PAGE_SIZE_DESCRIPTION,
  SEARCH_CASE_SENSITIVE_DESCRIPTION,
  SEARCH_FIELD_DESCRIPTION,
  SEARCH_MATCH_DESCRIPTION,
  SEARCH_QUERY_DESCRIPTION,
  SEARCH_SHARE_SCOPE_DESCRIPTION,
  SEARCH_VAULT_SCOPE_DESCRIPTION,
  SHARE_ID_SCOPE_DESCRIPTION,
  SORT_BY_DESCRIPTION,
  VAULT_NAME_SCOPE_DESCRIPTION,
} from "./constants.js";

export const listItemsInputSchema = z
  .object({
    vaultName: z.string().max(255).optional().describe(VAULT_NAME_SCOPE_DESCRIPTION),
    shareId: z.string().max(100).optional().describe(SHARE_ID_SCOPE_DESCRIPTION),
    filterType: z.enum(ITEM_FILTER_TYPES).optional().describe(FILTER_TYPE_DESCRIPTION),
    filterState: z.enum(ITEM_FILTER_STATES).optional().describe(FILTER_STATE_DESCRIPTION),
    sortBy: z.enum(ITEM_SORT_OPTIONS).optional().describe(SORT_BY_DESCRIPTION),
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(MAX_ITEM_LIST_PAGE_SIZE)
      .optional()
      .describe(PAGE_SIZE_DESCRIPTION),
    cursor: z.string().max(20).optional().describe(CURSOR_DESCRIPTION),
    output: z.enum(["json", "human"]).default("json").describe("Output format"),
  })
  .refine(
    (input) => {
      const hasVaultName = Boolean(input.vaultName);
      const hasShareId = Boolean(input.shareId);
      return hasVaultName !== hasShareId;
    },
    {
      message: "Provide exactly one of vaultName or shareId.",
    },
  );

export const searchItemsInputSchema = z
  .object({
    query: z.string().min(1).max(255).describe(SEARCH_QUERY_DESCRIPTION),
    field: z.literal("title").default("title").describe(SEARCH_FIELD_DESCRIPTION),
    match: z
      .enum(["contains", "prefix", "exact"])
      .default("contains")
      .describe(SEARCH_MATCH_DESCRIPTION),
    caseSensitive: z.boolean().default(false).describe(SEARCH_CASE_SENSITIVE_DESCRIPTION),
    vaultName: z.string().max(255).optional().describe(SEARCH_VAULT_SCOPE_DESCRIPTION),
    shareId: z.string().max(100).optional().describe(SEARCH_SHARE_SCOPE_DESCRIPTION),
    filterType: z.enum(ITEM_FILTER_TYPES).optional().describe(FILTER_TYPE_DESCRIPTION),
    filterState: z.enum(ITEM_FILTER_STATES).optional().describe(FILTER_STATE_DESCRIPTION),
    sortBy: z.enum(ITEM_SORT_OPTIONS).optional().describe(SORT_BY_DESCRIPTION),
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(MAX_ITEM_LIST_PAGE_SIZE)
      .optional()
      .describe(PAGE_SIZE_DESCRIPTION),
    cursor: z.string().max(20).optional().describe(CURSOR_DESCRIPTION),
  })
  .refine((input) => !(input.vaultName && input.shareId), {
    message: "Provide only one of vaultName or shareId.",
  });

export type ListItemsInput = z.infer<typeof listItemsInputSchema>;
export type SearchItemsInput = z.infer<typeof searchItemsInputSchema>;
