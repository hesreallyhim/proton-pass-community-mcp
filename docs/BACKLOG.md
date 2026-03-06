---
name: backlog
description: Transitional status snapshot of non-release-bound work items for proton-pass-community-mcp.
---

# Backlog

This document is now a lightweight transitional backlog to prevent stale planning drift.
As the project matures, backlog tracking should move to a dedicated system (for example GitHub Issues/Projects), while canonical implementation policy remains in the docs listed in `AGENTS.md`.

## Status Snapshot

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

1. Write gate + explicit confirmation model captured in `docs/TOOL_SCHEMA_PLAN.md` and enforced in tests (`test/server.test.ts`).
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
