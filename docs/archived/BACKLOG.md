---
name: backlog
description: Transitional status snapshot of non-release-bound work items for proton-pass-community-mcp.
---

# Backlog

This document is now a lightweight transitional backlog to prevent stale planning drift.
As the project matures, backlog tracking should move to a dedicated system (for example GitHub Issues/Projects), while canonical implementation policy remains in the docs listed in `AGENTS.md`.

## Status Snapshot

## Next Implementation Slice

Status: Ready to implement.

Goal: Add a minimal mutative-tool loop for throwaway-account integration testing.

Sequence:

1. `create_vault`
2. `create_login_item`
3. `update_item`
4. `delete_item`
5. `delete_vault`

Supporting read calls:

1. `list_items` to resolve `share_id` and `item_id` for update/delete paths.
2. Optional `view_item` to assert expected mutation results before cleanup.

Acceptance criteria:

1. Tools are registered in MCP with existing write-gate/confirmation controls.
2. End-to-end loop executes in throwaway account only (preflight required).
3. Integration test covers create -> update -> delete item and delete vault cleanup.

### 1. Secondary throwaway account for test/dev usage

Status: Mostly complete (operational model and docs are in place).

Completed:

1. Throwaway-account workflow and guardrails documented in `docs/testing/TEST_ACCOUNT_WORKFLOW.md`.
2. Auth/testing plan documented in `docs/testing/CODEX_MCP_AUTH_SPEC.md` and `docs/testing/CODEX_MCP_TEST_PLAN.md`.
3. Seed/reset/snapshot strategy documented in `docs/testing/THROWAWAY_DATA_PLAN.md`.

Remaining (incremental, only when needed):

1. Implement seed/reset/hydration scripts as destructive-tool work begins.
2. Promote only stable CI-relevant fixture artifacts into version control.

### 2. MCP permissions and consent boundaries

Status: Partially complete; sufficient for current release scope.

Completed:

1. Write gate + explicit confirmation model captured in `docs/TOOL_SCHEMA_PLAN.md` and enforced in the contract test suite (`test/server/*.test.ts`).
2. `ItemRef` contract set to reference-only list/search output (no nested secret-bearing fields).

Remaining:

1. Extend the same boundary rigor as additional planned tools are implemented.

### 3. Evaluate MCP vs skill vs connector architecture

Status: Closed / de-scoped.

Decision:

1. Project scope is MCP implementation.
2. Skill/connector usage is optional downstream integration context, not a blocker for MCP delivery.

### 4. Refactor/harden `toItemRef` normalization

Status: Complete for current scope; monitor for drift.

Completed:

1. Current `ItemRef` contract and extraction behavior are defined and implemented for current release needs.
2. Item-output policy decisions are documented in `docs/TOOL_SCHEMA_PLAN.md`.

Remaining:

1. Revisit only if new upstream shape drift or tool-flow requirements justify additional refactor work.
