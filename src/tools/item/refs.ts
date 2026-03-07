import {
  asRecord,
  extractItemType,
  firstNestedString,
  firstString,
  parsePassUri,
  shortId,
} from "../shared/item-utils.js";

export type ItemRef = {
  id: string;
  share_id: string | null;
  vault_id: string | null;
  type: string | null;
  title: string | null;
  display_title: string;
  state: string | null;
  create_time: string | null;
  modify_time: string | null;
  uri: string | null;
};

export function toItemRef(rawItem: unknown, index: number): ItemRef {
  const item = asRecord(rawItem);
  if (!item) {
    // Preserve pagination/reference behavior even when one entry is malformed.
    const fallbackId = `item-${index + 1}`;
    return {
      id: fallbackId,
      share_id: null,
      vault_id: null,
      type: null,
      title: null,
      display_title: `[untitled:${shortId(fallbackId)}]`,
      state: null,
      create_time: null,
      modify_time: null,
      uri: null,
    };
  }

  const existingUri = firstString(item, ["uri"]);
  const parsedUri = parsePassUri(existingUri);
  // Item list JSON is interpreted as snake_case-first (see ADR-002).
  const id = firstString(item, ["id", "item_id"]) ?? parsedUri.itemId ?? `item-${index + 1}`;
  const shareId =
    firstString(item, ["share_id"]) ??
    firstNestedString(item, ["share"], ["id", "share_id"]) ??
    parsedUri.shareId;
  const vaultId =
    firstString(item, ["vault_id"]) ?? firstNestedString(item, ["vault"], ["id", "vault_id"]);
  const title = firstNestedString(item, ["content"], ["title"]) ?? firstString(item, ["title"]);
  const type = extractItemType(item);

  const displayTitle = title ?? `[untitled:${shortId(id)}]`;
  const derivedUri = shareId ? `pass://${shareId}/${id}` : existingUri;

  return {
    id,
    share_id: shareId,
    vault_id: vaultId,
    type,
    title,
    display_title: displayTitle,
    state: firstString(item, ["state"]),
    create_time: firstString(item, ["create_time", "created_at"]),
    modify_time: firstString(item, ["modify_time", "updated_at"]),
    uri: derivedUri ?? null,
  };
}
