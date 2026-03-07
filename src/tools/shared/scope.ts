const SCOPE_ERROR_MESSAGE = "Provide exactly one of shareId or vaultName.";

export type ShareScope = {
  shareId?: string;
  vaultName?: string;
};

export function requireExactlyOneScope({ shareId, vaultName }: ShareScope): boolean {
  return Boolean(shareId) !== Boolean(vaultName);
}

export const scopeRefinement = {
  check: requireExactlyOneScope,
  message: SCOPE_ERROR_MESSAGE,
} as const;

export function assertExactlyOneScope(scope: ShareScope): void {
  if (!requireExactlyOneScope(scope)) {
    throw new Error(SCOPE_ERROR_MESSAGE);
  }
}

export function appendScopeArgs(args: string[], scope: ShareScope): void {
  assertExactlyOneScope(scope);
  if (scope.shareId) args.push("--share-id", scope.shareId);
  else args.push("--vault-name", scope.vaultName!);
}
