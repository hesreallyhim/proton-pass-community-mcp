# Refactoring Plan

> Produced 2026-03-06, based on analysis of all source files on the `reviews` branch (commit `ec23f1a`).

---

## Table of Contents

1. [Break up the monolithic `item.ts` (1102 lines)](#1-break-up-the-monolithic-itemts-1102-lines)
2. [Extract duplicated pagination/list-parsing infrastructure into shared utilities](#2-extract-duplicated-paginationlist-parsing-infrastructure-into-shared-utilities)
3. [Extract duplicated scope-validation logic ("shareId vs vaultName")](#3-extract-duplicated-scope-validation-logic-shareid-vs-vaultname)
4. [Convert `register-tools.ts` from imperative repetition to declarative tool definitions](#4-convert-register-toolsts-from-imperative-repetition-to-declarative-tool-definitions)
5. [Eliminate the duplicated `asRecord` helper and consolidate minor DRY violations](#5-eliminate-the-duplicated-asrecord-helper-and-consolidate-minor-dry-violations)

---

## 1. Break up the monolithic `item.ts` (1102 lines)

### Problem

`src/tools/item.ts` is **1102 lines** -- by far the largest file in the project and roughly 4x the size of any other source file. It contains:

- **~30 Zod input schemas** (lines 15-486)
- **~20 type aliases** (lines 487-510)
- Parsing helpers (`parseCursor`, `toItemRef`, `extractRawItemList`, `matchesQuery`)
- **~20 handler functions** spanning list, view, search, CRUD for multiple item types, move, trash/untrash, delete, share, members, alias, attachment, and TOTP

This violates the Single Responsibility Principle. A developer looking for the `createWifiItemHandler` must scroll through hundreds of unrelated schema definitions. Schemas, types, helpers, and handlers for fundamentally different domains (listing/search vs creation vs membership management) are all entangled.

### Specific locations

| Concern                                                                               | Lines                       | Approx. size |
| ------------------------------------------------------------------------------------- | --------------------------- | ------------ |
| Constants and shared schema fragments                                                 | 15-52                       | 38 lines     |
| Shared types (`ItemRef`) and helpers (`parseCursor`, `toItemRef`, etc.)               | 53-134                      | 82 lines     |
| List/search schemas and handlers                                                      | 136-667                     | 532 lines    |
| Create schemas (login, note, credit-card, wifi, custom, identity, alias) and handlers | 215-366, 737-877, 1087-1102 | ~350 lines   |
| View/TOTP schemas and handlers                                                        | 164-186, 669-735            | ~100 lines   |
| Move/update/trash/untrash/delete schemas and handlers                                 | 369-440, 879-1017           | ~200 lines   |
| Member/share schemas and handlers                                                     | 442-469, 1019-1085          | ~100 lines   |

### Why it matters

- **Cognitive load**: 1102 lines requires constant scrolling and mental bookmarking.
- **Merge conflicts**: Any two developers touching different item operations edit the same file.
- **Testability**: The single-file-for-everything pattern makes it harder to unit-test one concern in isolation.
- **Discoverability**: New contributors cannot guess which file contains, say, WiFi item creation.

### Proposed solution

Split `src/tools/item.ts` into focused modules under `src/tools/item/`:

```
src/tools/item/
  index.ts                  -- barrel re-export (preserves the current import surface)
  constants.ts              -- shared constants, enum arrays, description strings
  types.ts                  -- ItemRef and other shared types
  parsing.ts                -- parseCursor, toItemRef, extractRawItemList, matchesQuery
  schemas/
    list.ts                 -- listItemsInputSchema, searchItemsInputSchema
    view.ts                 -- viewItemInputSchema, itemTotpInputSchema
    create.ts               -- all create*InputSchema definitions
    mutate.ts               -- move, update, trash, untrash, delete schemas
    members.ts              -- share, listMembers, updateMember, removeMember schemas
  handlers/
    list.ts                 -- listItemsHandler, searchItemsHandler
    view.ts                 -- viewItemHandler, itemTotpHandler
    create.ts               -- all create*Handler functions
    mutate.ts               -- moveItemHandler, updateItemHandler, trash/untrash/deleteItemHandler
    members.ts              -- shareItemHandler, listItemMembersHandler, etc.
```

The barrel `index.ts` re-exports everything, so `register-tools.ts` and the test file continue to work with zero changes to their imports.

### Impact: **High**

This is the single highest-value refactoring. It unblocks easier maintenance, reduces merge conflicts, and makes the codebase navigable.

---

## 2. Extract duplicated pagination/list-parsing infrastructure into shared utilities

### Problem

Three files contain **near-identical** implementations of pagination cursor parsing and raw-list extraction:

| File                  | Function                 | Lines   |
| --------------------- | ------------------------ | ------- |
| `src/tools/item.ts`   | `parseCursor`            | 66-77   |
| `src/tools/vault.ts`  | `parseCursor`            | 156-167 |
| `src/tools/invite.ts` | `parseCursor`            | 24-35   |
| `src/tools/item.ts`   | `extractRawItemList`     | 128-134 |
| `src/tools/vault.ts`  | `extractRawVaultMembers` | 197-214 |
| `src/tools/invite.ts` | `extractRawInviteList`   | 72-89   |

The `parseCursor` functions are **character-for-character identical** across all three files. The `extractRaw*` functions differ only in the list of candidate key names they probe (e.g., `["items"]` vs `["members", "vault_members", ...]` vs `["invites", "invitations", ...]`), but the structural logic is the same.

Additionally, the pagination response construction pattern is repeated in each:

```typescript
const start = parseCursor(cursor);
const size = pageSize ?? DEFAULT_PAGE_SIZE;
const end = start + size;
const items = refs.slice(start, end);
const nextCursor = end < refs.length ? String(end) : null;
```

This block appears in `listItemsHandler`, `searchItemsHandler`, `listVaultMembersHandler`, and `listInvitesHandler`.

### Why it matters

- **DRY violation**: Any bug fix or behavior change to cursor parsing must be applied in three places.
- **Inconsistency risk**: The vault version probes more candidate keys than the item version (it includes `"users"`, `"results"`, and a single-array-value fallback). If those heuristics are useful, the item version lacks them; if they are not, the vault version has dead code.
- **Test burden**: Each copy needs its own tests for the same logic.

### Proposed solution

Create `src/tools/pagination.ts`:

```typescript
export function parseCursor(cursor?: string): number {
  /* ... single implementation ... */
}

export function extractArrayFromParsed(parsed: unknown, candidateKeys: string[]): unknown[] | null {
  /* ... generic implementation with fallback heuristic ... */
}

export function paginateRefs<T>(
  refs: T[],
  cursor: string | undefined,
  pageSize: number | undefined,
  defaultPageSize: number,
): {
  items: T[];
  pageSize: number;
  cursor: string;
  returned: number;
  total: number;
  nextCursor: string | null;
} {
  /* ... single implementation of the slice-and-cursor logic ... */
}
```

Then each handler calls:

```typescript
const rawItems = extractArrayFromParsed(parsed, ["items"]);
// ...
const page = paginateRefs(refs, cursor, pageSize, DEFAULT_ITEM_LIST_PAGE_SIZE);
```

### Impact: **High**

Eliminates ~90 lines of pure duplication and prevents divergence bugs. This is also a prerequisite for cleanly splitting `item.ts` (Point 1), since the extracted utilities become shared dependencies.

---

## 3. Extract duplicated scope-validation logic ("shareId vs vaultName")

### Problem

The pattern of validating mutually exclusive `shareId` / `vaultName` parameters and building the corresponding CLI args appears **at least 19 times** across the codebase:

**In Zod `.refine()` callbacks** (schema-level):

- `vault.ts`: lines 33-41, 71-80, 89-99, 108-117, 119-135 (5 separate schemas)
- `settings.ts`: lines 49-58
- `item.ts`: lines 153-162, 211, 379-387, 406-411, 421-426, 483-485

**In handler runtime guards** (handler-level):

- `vault.ts`: lines 225-227, 286, 301, 317, 331, 346, 361 (7 handlers)
- `settings.ts`: lines 103-104
- `item.ts`: lines 516-519, 606, 681, 739-740, 770-771, 786-787, 806-807, 828-829, 850-851, 867-868, 920, 943, 964, 1092

Every vault-scoped handler has this boilerplate:

```typescript
if (!!shareId === !!vaultName) throw new Error("Provide exactly one of shareId or vaultName.");
const args = ["vault", "some-command"];
if (shareId) args.push("--share-id", shareId);
else args.push("--vault-name", vaultName!);
```

### Why it matters

- **Noise**: The same 3-4 lines of validation clutter every handler, obscuring the actual business logic.
- **Inconsistency**: Some handlers use `if (!!shareId === !!vaultName)`, others use `if (shareId && vaultName)` (which does NOT catch the case where both are absent). The Zod `.refine()` uses `hasShareId !== hasVaultName`. These are semantically different validation strategies for the same constraint.
- **Fragility**: Adding a third scope selector in the future (e.g., `vaultId`) means touching 19+ locations.

### Proposed solution

Create a shared Zod refinement factory and an args-builder helper in a new `src/tools/scope.ts`:

```typescript
import { z } from "zod";

/** Zod refinement for exactly-one-of shareId/vaultName. */
export function requireExactlyOneScope(input: { shareId?: string; vaultName?: string }): boolean {
  return Boolean(input.shareId) !== Boolean(input.vaultName);
}

/** Standard scope refinement config for use with .refine() */
export const scopeRefinement = {
  check: requireExactlyOneScope,
  message: "Provide exactly one of shareId or vaultName.",
} as const;

/** Validate and append --share-id or --vault-name to CLI args. */
export function appendScopeArgs(
  args: string[],
  scope: { shareId?: string; vaultName?: string },
): void {
  if (!requireExactlyOneScope(scope)) {
    throw new Error("Provide exactly one of shareId or vaultName.");
  }
  if (scope.shareId) args.push("--share-id", scope.shareId);
  else args.push("--vault-name", scope.vaultName!);
}
```

This reduces each handler to a single function call:

```typescript
// Before (vault.ts updateVaultHandler, line 286-290):
if (!!shareId === !!vaultName) throw new Error("Provide exactly one of shareId or vaultName.");
const args = ["vault", "update"];
if (shareId) args.push("--share-id", shareId);
else args.push("--vault-name", vaultName!);

// After:
const args = ["vault", "update"];
appendScopeArgs(args, { shareId, vaultName });
```

Similarly, the 5+ identical `.refine()` calls in `vault.ts` schemas become:

```typescript
.refine(scopeRefinement.check, { message: scopeRefinement.message })
```

### Impact: **Medium**

This is a mechanical change with low risk but high readability payoff. It also fixes the subtle inconsistency between the `!!a === !!b` guard (which requires exactly one) and the `a && b` guard (which only rejects both-present, not both-absent).

---

## 4. Convert `register-tools.ts` from imperative repetition to declarative tool definitions

### Problem

`src/server/register-tools.ts` is **541 lines** of near-identical `server.registerTool(...)` calls. Every tool registration follows one of two patterns:

**Pattern A** (with input schema):

```typescript
server.registerTool(
  "tool_name",
  { description: "...", inputSchema: someInputSchema },
  withAuthErrorHandling(async (input) => someHandler(passCli, input)),
);
```

**Pattern B** (no input schema):

```typescript
server.registerTool(
  "tool_name",
  { description: "..." },
  withAuthErrorHandling(async () => someHandler(passCli)),
);
```

There are **43 tool registrations** in this file. The structural repetition is extreme -- the only varying parts are the tool name, description, schema, and handler reference.

### Why it matters

- **Boilerplate**: Adding a new tool requires copying 6-8 lines and changing 3-4 values. This is error-prone (forgetting `withAuthErrorHandling`, misspelling the tool name, etc.).
- **Readability**: It takes significant scrolling to audit which tools are registered.
- **Auditability**: There is no single place to see the full tool manifest at a glance.

### Proposed solution

Define tools as a declarative array of descriptors, then loop to register:

```typescript
type ToolDescriptor =
  | { name: string; description: string; handler: () => Promise<unknown> }
  | {
      name: string;
      description: string;
      inputSchema: z.ZodType;
      handler: (input: any) => Promise<unknown>;
    };

const tools: ToolDescriptor[] = [
  {
    name: "view_session_info",
    description: "View current Proton Pass session/account summary from pass-cli info.",
    handler: () => viewSessionInfoHandler(passCli),
  },
  {
    name: "list_vaults",
    description: "List vaults accessible to the current authenticated user.",
    inputSchema: listVaultsInputSchema,
    handler: (input) => listVaultsHandler(passCli, input),
  },
  // ... all 43 tools
];

for (const tool of tools) {
  if ("inputSchema" in tool) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema },
      withAuthErrorHandling(async (input) => tool.handler(input)),
    );
  } else {
    server.registerTool(
      tool.name,
      { description: tool.description },
      withAuthErrorHandling(async () => tool.handler()),
    );
  }
}
```

This approach:

- Makes the tool manifest scannable (each tool is 3-5 lines instead of 6-8).
- Makes it trivial to add cross-cutting concerns (logging, rate limiting) to all tools.
- Reduces the file from ~541 lines to ~250 lines.
- Note: `check_status` currently does NOT wrap with `withAuthErrorHandling` -- this would be preserved as a special case or a flag in the descriptor.

### Impact: **Medium**

This is a readability and maintainability improvement. The current code works fine; the refactoring makes it easier to audit and extend.

---

## 5. Eliminate the duplicated `asRecord` helper and consolidate minor DRY violations

### Problem

The `asRecord` utility function is **defined twice** with identical logic:

1. `src/tools/item-utils.ts` (line 6-11) -- exported and used by `item.ts`, `vault.ts`, `invite.ts`, `settings.ts`
2. `src/resources/item-create-templates.ts` (line 24-27) -- private, used only within the templates module

These are the same function:

```typescript
function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
```

Additionally, there are several minor repeated patterns:

**a) The write-handler epilogue** (22 occurrences across 5 files):

```typescript
const { stdout, stderr } = await passCli(args);
const out = joinStdoutStderr(stdout, stderr);
return asTextContent(out || "OK");
```

**b) The `confirm` schema field** is redefined inline in every write schema:

```typescript
confirm: z.boolean().optional().describe("Must be true to execute the write operation"),
```

This exact line appears in roughly 20 schemas. `invite.ts` (line 105) already extracts it:

```typescript
const confirmInput = z.boolean().optional().describe("Must be true to execute the write operation");
```

but this pattern is not shared or used elsewhere.

### Why it matters

- The duplicate `asRecord` is a clear DRY violation. If the type guard needs updating (e.g., to exclude `Date` or `RegExp` objects), both copies must be found and changed.
- The 22 occurrences of the write-handler epilogue add noise and mean any change to the default success message ("OK") or the stdout/stderr joining behavior requires editing many files.
- The repeated `confirm` field definition is cosmetic but contributes to schema bloat.

### Proposed solution

**a) `asRecord` deduplication**: Have `item-create-templates.ts` import from `item-utils.ts`:

```typescript
// src/resources/item-create-templates.ts
import { asRecord } from "../tools/item-utils.js";
```

Delete the private `asRecord` function on lines 24-27.

**b) Write-handler epilogue**: Add a helper to `src/pass-cli/output.ts`:

```typescript
export function asWriteResult(stdout: string, stderr: string) {
  const out = joinStdoutStderr(stdout, stderr);
  return asTextContent(out || "OK");
}
```

Then each write handler simplifies from 3 lines to 1:

```typescript
// Before:
const { stdout, stderr } = await passCli(args);
const out = joinStdoutStderr(stdout, stderr);
return asTextContent(out || "OK");

// After:
const { stdout, stderr } = await passCli(args);
return asWriteResult(stdout, stderr);
```

**c) Shared `confirm` schema field**: Add to a shared constants/schemas file:

```typescript
export const confirmField = z
  .boolean()
  .optional()
  .describe("Must be true to execute the write operation");
```

### Impact: **Low**

These are small, safe changes. Individually each saves only a few lines, but collectively they reduce noise across the entire codebase and establish a pattern of centralizing shared primitives.

---

## Priority Summary

| #   | Refactoring                          | Impact | Risk                                 | Effort   |
| --- | ------------------------------------ | ------ | ------------------------------------ | -------- |
| 1   | Split `item.ts` into focused modules | High   | Low (barrel re-export preserves API) | Medium   |
| 2   | Extract shared pagination utilities  | High   | Low (pure functions, easy to test)   | Low      |
| 3   | Extract scope-validation helpers     | Medium | Low (mechanical replacement)         | Low      |
| 4   | Declarative tool registration        | Medium | Low (behavioral equivalence)         | Medium   |
| 5   | Deduplicate `asRecord` and minor DRY | Low    | Very Low                             | Very Low |

### Recommended execution order

1. **Point 5 first** -- quick wins, no structural changes, builds shared primitives needed by later steps.
2. **Point 2** -- extract pagination utilities (needed before splitting item.ts).
3. **Point 3** -- extract scope validation (needed before splitting item.ts).
4. **Point 1** -- the big split of item.ts, now with shared utilities already in place.
5. **Point 4** -- declarative tool registration (independent of the others, can be done anytime).

Each step should be a separate PR/commit to keep reviews focused and reversible.
