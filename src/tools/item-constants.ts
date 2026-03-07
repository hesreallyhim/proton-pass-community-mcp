export const DEFAULT_ITEM_LIST_PAGE_SIZE = 100;
export const MAX_ITEM_LIST_PAGE_SIZE = 250;

export const ITEM_FILTER_TYPES = [
  "note",
  "login",
  "alias",
  "credit-card",
  "identity",
  "ssh-key",
  "wifi",
  "custom",
] as const;

export const ITEM_FILTER_STATES = ["active", "trashed"] as const;

export const ITEM_SORT_OPTIONS = [
  "alphabetic-asc",
  "alphabetic-desc",
  "created-asc",
  "created-desc",
] as const;

export const WIFI_SECURITY_OPTIONS = ["wpa", "wpa2", "wpa3", "wep", "open", "none"] as const;
export const SHARE_ROLE_OPTIONS = ["viewer", "editor", "manager"] as const;

export const VAULT_NAME_SCOPE_DESCRIPTION =
  "Vault name scope. Provide exactly one of vaultName or shareId.";
export const SHARE_ID_SCOPE_DESCRIPTION =
  "Share ID scope. Provide exactly one of shareId or vaultName.";

export const FILTER_TYPE_DESCRIPTION =
  "Filter items by type. Allowed values: note, login, alias, credit-card, identity, ssh-key, wifi, custom.";
export const FILTER_STATE_DESCRIPTION =
  'Filter items by state. Allowed values: active, trashed. Use "active" to exclude trashed items.';
export const SORT_BY_DESCRIPTION =
  "Sort items. Allowed values: alphabetic-asc, alphabetic-desc, created-asc, created-desc.";
export const PAGE_SIZE_DESCRIPTION = "Number of items per page (1-250, default 100)";
export const CURSOR_DESCRIPTION = "Pagination cursor from a previous response's nextCursor";

export const SEARCH_QUERY_DESCRIPTION = "Search query string";
export const SEARCH_FIELD_DESCRIPTION = "Field to search (currently title only)";
export const SEARCH_MATCH_DESCRIPTION = "Match strategy for the query";
export const SEARCH_CASE_SENSITIVE_DESCRIPTION = "Whether the search is case-sensitive";
export const SEARCH_VAULT_SCOPE_DESCRIPTION = "Limit search to a specific vault by name";
export const SEARCH_SHARE_SCOPE_DESCRIPTION = "Limit search to a specific share by ID";
