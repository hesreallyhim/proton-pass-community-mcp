export function matchesQuery({
  query,
  candidate,
  match,
  caseSensitive,
}: {
  query: string;
  candidate: string;
  match: "contains" | "prefix" | "exact";
  caseSensitive: boolean;
}): boolean {
  const left = caseSensitive ? candidate : candidate.toLowerCase();
  const right = caseSensitive ? query : query.toLowerCase();

  if (match === "exact") return left === right;
  if (match === "prefix") return left.startsWith(right);
  return left.includes(right);
}
