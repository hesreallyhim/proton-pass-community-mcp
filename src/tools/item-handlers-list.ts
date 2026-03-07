import { asJsonTextOrRaw, asTextContent } from "../pass-cli/output.js";
import type { PassCliRunner } from "../pass-cli/runner.js";
import { extractArrayFromParsed, paginateRefs } from "./pagination.js";
import { DEFAULT_ITEM_LIST_PAGE_SIZE } from "./item-constants.js";
import { matchesQuery } from "./item-query.js";
import { toItemRef } from "./item-refs.js";
import type { ListItemsInput, SearchItemsInput } from "./item-schemas-list.js";

export async function listItemsHandler(
  passCli: PassCliRunner,
  { vaultName, shareId, filterType, filterState, sortBy, pageSize, cursor, output }: ListItemsInput,
) {
  if (!vaultName && !shareId) {
    throw new Error("Provide exactly one of vaultName or shareId.");
  }
  if (vaultName && shareId) throw new Error("Provide only one of vaultName or shareId.");
  if (output !== "json" && (pageSize !== undefined || cursor !== undefined)) {
    throw new Error('Pagination is supported only with {"output":"json"}.');
  }

  const args = ["item", "list"];
  if (shareId) args.push("--share-id", shareId);
  if (filterType) args.push("--filter-type", filterType);
  if (filterState) args.push("--filter-state", filterState);
  if (sortBy) args.push("--sort-by", sortBy);
  args.push("--output", output);
  if (vaultName) args.push("--", vaultName);

  const { stdout } = await passCli(args);
  if (output !== "json") {
    return asTextContent(asJsonTextOrRaw(stdout));
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return asTextContent(asJsonTextOrRaw(stdout));
  }

  const rawItems = extractArrayFromParsed(parsed, ["items"]);
  if (!rawItems) {
    return asTextContent(asJsonTextOrRaw(stdout));
  }
  const refs = rawItems.map((item, index) => toItemRef(item, index));
  const page = paginateRefs(refs, cursor, pageSize, DEFAULT_ITEM_LIST_PAGE_SIZE);

  const structuredContent = {
    ...page,
  };

  return {
    content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
  };
}

export async function searchItemsHandler(
  passCli: PassCliRunner,
  {
    query,
    field,
    match,
    caseSensitive,
    vaultName,
    shareId,
    filterType,
    filterState,
    sortBy,
    pageSize,
    cursor,
  }: SearchItemsInput,
) {
  if (vaultName && shareId) {
    throw new Error("Provide only one of vaultName or shareId.");
  }

  const args = ["item", "list"];
  if (shareId) args.push("--share-id", shareId);
  if (filterType) args.push("--filter-type", filterType);
  if (filterState) args.push("--filter-state", filterState);
  if (sortBy) args.push("--sort-by", sortBy);
  args.push("--output", "json");
  if (vaultName) args.push("--", vaultName);

  const { stdout } = await passCli(args);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return asTextContent(asJsonTextOrRaw(stdout));
  }

  const rawItems = extractArrayFromParsed(parsed, ["items"]);
  if (!rawItems) {
    return asTextContent(asJsonTextOrRaw(stdout));
  }
  const refs = rawItems.map((item, index) => toItemRef(item, index));
  const filtered = refs.filter((item) =>
    item.title
      ? matchesQuery({
          query,
          candidate: item.title,
          match,
          caseSensitive,
        })
      : false,
  );

  const page = paginateRefs(filtered, cursor, pageSize, DEFAULT_ITEM_LIST_PAGE_SIZE);
  const structuredContent = {
    ...page,
    queryMeta: {
      field,
      match,
      caseSensitive,
    },
  };

  return {
    content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
  };
}
