import type { ItemTotpInput, ViewItemInput } from "./schemas-view.js";

export function ensureSingleOptionalScope(shareId?: string, vaultName?: string): void {
  if (shareId && vaultName) {
    throw new Error("Provide only one of shareId or vaultName.");
  }
}

export function appendOptionalScopeArgs(
  args: string[],
  shareId?: string,
  vaultName?: string,
): void {
  ensureSingleOptionalScope(shareId, vaultName);
  if (shareId) args.push("--share-id", shareId);
  else if (vaultName) args.push("--vault-name", vaultName);
}

export function appendRequiredItemSelectorArgs(
  args: string[],
  itemId?: string,
  itemTitle?: string,
): void {
  if (itemId && itemTitle) throw new Error("Provide only one of itemId or itemTitle.");
  if (!itemId && !itemTitle) throw new Error("Provide itemId or itemTitle.");

  if (itemId) args.push("--item-id", itemId);
  else args.push("--item-title", itemTitle!);
}

type ViewReference = Pick<
  ViewItemInput | ItemTotpInput,
  "uri" | "shareId" | "vaultName" | "itemId" | "itemTitle" | "field"
>;

function ensureUriArgumentExclusivity(reference: ViewReference): void {
  const { uri, shareId, vaultName, itemId, itemTitle, field } = reference;
  const usingUri = !!uri;
  if (usingUri && (shareId || vaultName || itemId || itemTitle)) {
    throw new Error("uri is mutually exclusive with selector arguments.");
  }
  if (usingUri && field) {
    throw new Error("Encode the field in uri instead of combining uri with field.");
  }
}

function validateViewReference(reference: ViewReference): void {
  const { uri, shareId, vaultName, itemId, itemTitle } = reference;
  const usingSelectors = (shareId || vaultName) && (itemId || itemTitle);
  if (!uri && !usingSelectors) {
    throw new Error("Provide either uri OR (shareId|vaultName) AND (itemId|itemTitle).");
  }
  ensureUriArgumentExclusivity(reference);
  if (shareId && vaultName) throw new Error("shareId and vaultName are mutually exclusive.");
  if (itemId && itemTitle) throw new Error("itemId and itemTitle are mutually exclusive.");
}

export function buildViewLikeArgs(
  command: "view" | "totp",
  input: ViewItemInput | ItemTotpInput,
): string[] {
  const { uri, shareId, vaultName, itemId, itemTitle, field, output } = input;
  validateViewReference({ uri, shareId, vaultName, itemId, itemTitle, field });
  const args: string[] = ["item", command];

  if (uri) {
    args.push("--output", output, "--", uri!);
    return args;
  }

  if (shareId) args.push("--share-id", shareId);
  else args.push("--vault-name", vaultName!);

  if (itemId) args.push("--item-id", itemId);
  else args.push("--item-title", itemTitle!);

  if (field) args.push("--field", field);
  args.push("--output", output);
  return args;
}
