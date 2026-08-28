import type { PassCliRunner } from "../../pass-cli/runner.js";
import { asRecord } from "../shared/item-utils.js";
import { paginateRefs } from "../shared/pagination.js";
import { DEFAULT_ITEM_LIST_PAGE_SIZE } from "./constants.js";
import { matchesQuery } from "./query.js";
import { toItemRef } from "./refs.js";
import type { ListItemsInput, SearchItemsInput } from "./schemas-list.js";

function parseItemList(stdout: string): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error("Invalid JSON from pass-cli item list; refusing to return unfiltered output.");
  }
  const items = Array.isArray(parsed) ? parsed : asRecord(parsed)?.items;
  if (!Array.isArray(items)) {
    throw new Error("Unexpected pass-cli item list shape; expected an items array.");
  }
  return items;
}

type ItemListOptions = Pick<
  ListItemsInput,
  "vaultName" | "shareId" | "filterType" | "filterState" | "sortBy"
>;

function buildItemListArgs({
  vaultName,
  shareId,
  filterType,
  filterState,
  sortBy,
}: ItemListOptions): string[] {
  const args = ["item", "list"];
  if (shareId) args.push("--share-id", shareId);
  if (filterType) args.push("--filter-type", filterType);
  if (filterState) args.push("--filter-state", filterState);
  if (sortBy) args.push("--sort-by", sortBy);
  args.push("--output", "json");
  if (vaultName) args.push("--", vaultName);
  return args;
}

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

  const args = buildItemListArgs({ vaultName, shareId, filterType, filterState, sortBy });
  const { stdout } = await passCli(args);
  const rawItems = parseItemList(stdout);
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

  const args = buildItemListArgs({ vaultName, shareId, filterType, filterState, sortBy });
  const { stdout } = await passCli(args);

  const rawItems = parseItemList(stdout);
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
