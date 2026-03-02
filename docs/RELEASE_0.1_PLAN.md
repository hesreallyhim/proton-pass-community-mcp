---
name: release-0-1-plan
description: Canonical product and engineering plan for proton-pass-community-mcp release 0.1 scope and acceptance criteria.
---

# Release 0.1 Plan (First Public Release)

## Goal

Ship a safe, useful first release of `proton-pass-community-mcp` focused on read-oriented credential discovery and retrieval, so we can validate real model usage patterns before expanding write/mutative tooling.

## Scope

### In Scope (Release 0.1)

1. `view_session_info`
2. `view_user_info`
3. `check_status`
4. `list_vaults`
5. `list_items`
6. `view_item`
7. `search_items`
8. `list_shares`

## Current Gap Analysis (2026-03-01)

Status is evaluated against currently registered MCP tools (`src/server/register-tools.ts`).

### In-Scope Tool Coverage

1. `view_session_info`: Implemented and registered.
2. `view_user_info`: Implemented and registered.
3. `check_status`: Implemented and registered.
4. `list_vaults`: Implemented and registered.
5. `list_items`: Implemented and registered. [USER: MAKE SURE LIST CONTAINS REFERENCES/METADATA ONLY, NOT CONTENT]
6. `view_item`: Implemented and registered.
7. `search_items`: Not implemented and not registered.
8. `list_shares`: Handler exists (`src/tools/share.ts`) but tool is not registered.

### Remaining Work for 0.1

0. Go through codebase and change all `command_subcommand` style wording to the reverse (and remove `pass_` prefixes) (e.g. `pass_vault_list` => `list_vaults`).
1. Implement `search_items` with title-based matching and pagination.
2. Register `list_shares` and add tests for registration/behavior.
3. De-register non-0.1 mutative tools from default registration surface by commenting out `server.registerTool(...)` lines in `src/server/register-tools.ts` (retain implementation code for later releases).
4. Align inspector smoke checks to 0.1 in-scope tools. [USER: SKIP FOR NOW]
5. Finalize `list_items` output contract for token-efficient reference-first behavior. [USER: ITEM-REFERENCES-ONLY]
6. ... [USER: SEE EXECUTION PLAN BELOW]

### Stretch Scope (Release 0.1 if low risk)

1. `list_items` filter parity (`filterType`, `filterState`, `sortBy`)
2. `search_vaults` (if real-world vault counts justify dedicated search)

### Out of Scope (Release 0.1)

1. All mutative operations (`vault create/update/delete`, `item create/update/delete`, etc.)
2. Sharing/member management tools
3. Advanced workflow tools (`run`, `ssh-agent`, attachment download)

## Release Surface Policy

Policy for release branches when code exists but is not in release scope:

1. Code may remain in the repository if it is not part of the release contract.
2. Out-of-scope tools must not be exposed in MCP by default.
   - Operational rule: do not call `server.registerTool(...)` for out-of-scope tools.
3. Release docs and smoke tests must reflect only the registered release surface.
4. If a future release needs the retained code, exposure happens by explicit tool registration and docs update.

## `inject` Evaluation and Decision

`pass-cli inject` is operationally useful, but it is not purely read-only in practice:

1. It can write resolved secrets to files (`--out-file`) and supports overwrite behavior (`--force`).
2. It can emit resolved secrets to stdout.
3. It increases exfiltration risk compared to reference-list/read-by-id patterns.

Decision for Release 0.1:

1. Do **not** include `inject` in 0.1.
2. Revisit in 0.2+ behind a stricter permission profile and explicit data-handling safeguards.

Re-entry criteria for `inject`:

1. Explicit consent boundary for secret materialization.
2. Default-safe mode (for example: stdout-only disabled by default, or explicit destination constraints).
3. Clear host/client UX expectations for high-sensitivity tool calls.

## Safety Model for 0.1

1. Maintain strict separation of list vs full-read operations.
2. Keep `list_items` token-minimized (reference-first payload).
3. Keep `search_items` result payloads token-minimized (reference-first payload).
4. Require explicit item selection (`view_item`) for sensitive field access.
5. Avoid hidden cross-tool state that implicitly broadens access.
6. Preserve least-privilege assumptions per tool invocation.

## Search Policy (0.1)

1. `search_items` is title-based by project policy.
2. Title is not guaranteed by upstream contract, but 0.1 search semantics are still title-only.
3. Items without a usable title are discoverable via `list_items` and then `view_item`.

## Authentication Strategy (0.1)

1. Authentication is user-managed out-of-band via `pass-cli` (outside MCP tool calls).
2. MCP tools must never request credentials, OTP codes, or private keys.
3. On authentication failures, tools return a standardized error contract and remediation:
   - `AUTH_REQUIRED` or `AUTH_EXPIRED`
   - user action: run `pass-cli login` outside MCP and retry
4. `check_status` also validates CLI version compatibility against the pinned MCP baseline.
   - baseline default: `pass-cli` `1.5.2`
   - patch mismatch: warn
   - higher minor on same major: warn
   - lower minor on same major: error
   - major mismatch: error
5. Use `check_status` once as a session preflight before normal tool workflows (not before every tool call).
6. If auth later expires mid-session, rely on `AUTH_*` tool errors and re-authenticate out-of-band before retrying.
7. Model-facing guidance for auth errors:
   - explain required user action
   - do not attempt credential collection or secret recovery workflows

Example contract:

```json
{
  "error_code": "AUTH_REQUIRED",
  "retryable": true,
  "user_action": "Run \"pass-cli login\" outside MCP, then retry this tool.",
  "auth_managed_by_user": true
}
```

## Vault vs Share Policy (0.1)

1. Treat vaults as primary user-facing containers.
2. Treat `share_id` as canonical operational selector for deterministic tool chaining.
3. Include `share_id` and `vault_id` in item reference outputs where available.
4. Support both vault-oriented and share-oriented selector inputs where CLI supports both.
5. Expose `list_shares` so clients can reason about vault/item sharing relationships explicitly.

## Product Requirements

### Functional Requirements

1. `view_session_info` returns account/session status reliably.
2. `view_user_info` returns user account details in JSON/human output modes.
3. `list_vaults` returns vault references without schema validation errors.
4. `list_shares` returns share relationships in structured output.
5. `list_items` supports vault selection, pagination, and stable cursor behavior.
6. `search_items` supports title-based lookup with pagination and stable matching behavior.
7. `view_item` supports URI mode and selector mode with strict argument validation.

### Quality Requirements

1. `npm run check` passes.
2. Inspector smoke flow passes for in-scope tools.
3. Error messages are actionable and deterministic for invalid input combinations.
4. Tool outputs are structured enough for downstream model reasoning without excessive payload bloat.

## Runtime Baseline (0.1)

1. Baseline runtime is Node.js `24` (`.nvmrc` and package engine policy).
2. Rationale: dependency/audit pressure and Node.js `22` lifecycle risk near release.
3. Although this project is a stdio server, runtime baseline still follows dependency/security constraints first.
4. Re-evaluate Node.js `22` compatibility post-0.1 only if ecosystem pressure justifies back-compat.

## Success Criteria

1. Models can complete common read workflows:
   - discover vaults
   - search items by title/query
   - find candidate item references
   - retrieve a specific item/field
2. No known high-risk data overexposure path in default list/read flow.
3. Early users can evaluate utility without enabling any mutative operations.

## Risks and Mitigations

1. Risk: `list_items` payload shape drift from CLI output (`{items:[...]}` vs assumptions).
   - Mitigation: normalize shape in MCP layer and keep tests for observed formats.
2. Risk: docs vs CLI contract drift.
   - Mitigation: maintain drift register and validate against installed CLI behavior.
3. Risk: title/search ambiguity in large vaults.
   - Mitigation: use deterministic title-search semantics + stable IDs/share IDs in search results.

## Execution Plan

1. Finalize `list_items` contract (reference-first output + filters + pagination consistency).
2. Implement `search_items` (title-based) with pagination and reference-first output.
3. Implement `list_shares` wrapper and structured output.
4. Verify `view_item` selector/URI validation and output behavior against test fixtures.
5. Expand inspector smoke checks for in-scope tools. [USER: DEFER]
6. Publish release notes defining 0.1 read-focused boundaries and explicit non-goals.
7. Revise README.md
8. Add LICENSE (GPL 3+) and other community health files. [USER: NOTE! ADD THIRD-PARTY LICENSE FOR PROTON DOCS]
9. Add SKILL.md.
10. Add CI workflows and formalize release strategy.

## CI and Release Strategy (0.1)

1. CI gate (`.github/workflows/ci.yml`):
   - Trigger on pull requests and pushes to `main`.
   - Use Node.js `24`.
   - Run `npm ci`.
   - Run `npm run check`.
   - Keep inspector smoke/integration out of required CI checks for now.
2. Conventional commit enforcement (`.github/workflows/conventional-pr-title.yml`):
   - Trigger on pull requests targeting `main` and release-style `v*` branches.
   - Use a GitHub Marketplace action (`amannn/action-semantic-pull-request`) to validate Conventional Commit PR titles.
   - No local branch commit hook is required by default; policy is enforced at PR gate for `main`/`v*` targets.
3. Release automation (`.github/workflows/release-please.yml`):
   - Use Release Please for single-package versioning/changelog/tag/release flow.
   - Release PR is the formal pre-release checkpoint.
   - Merging the release PR cuts the Git tag and GitHub Release.
4. Commit policy for maintainers:
   - Use Conventional Commits for all merge-bound work.
   - If a PR title is non-conforming, update title before merge.

## Stretch Goals

1. filter and sort operations on list_items (by title, created_at, or modified_at (no content-based fields)).
2. search_vaults and search_shares.

## Open Questions

1. Should 0.1 break `list_items` output compatibility immediately or ship a temporary compatibility flag? [USER: Q IS MIS-STATED - NOT ABOUT COMPATIBILITY - LIST_ITEMS MUST NOT EXPOSE ITEM CONTENTS - HARD CONSTRAINT]
2. Should `view_item` default to minimal field output in JSON mode, or keep full item JSON by default? [USER: FULL ITEM]
3. Is `search_vaults` necessary for 0.1, or defer until observed vault-scale demand? [USER: STRETCH GOAL]
