---
name: backlog
description: Canonical backlog of open, non-release-bound work items for proton-pass-community-mcp.
---

# Backlog

## Security and Test Environment

1. Set up a secondary Proton account for disposable testing data.

- Create non-production vaults/items only.
- Use this account for MCP integration tests and exploratory CLI probing.
- Keep all real credentials and sensitive information out of test runs.
- Document setup steps and account usage rules once established.

2. Define MCP permissions and consent boundaries across all tools.

- Define strict permission scope per tool so one tool call cannot implicitly widen access for another.
- Validate that list/search tools return only minimal reference data unless explicitly authorized for full item reads.
- Document boundary rules and expected client behavior for permission checks.

3. Evaluate LLM integration options and choose the primary architecture.

- Compare `MCP`, `skill`, and `connector` approaches for this project.
- Define evaluation criteria (security boundaries, UX friction, portability, maintenance cost, ecosystem support).
- Decide primary integration model and document rationale, with fallback/interop plan if needed.

4. Refactor and harden item-list JSON normalization (`toItemRef`) for maintainability.

- Split extraction into smaller, named helpers (identity, scope, type, title, timestamps, URI derivation).
- Add fixture-based shape tests using anonymized upstream snapshots to detect drift early.
- Document supported raw-field paths and fallback precedence in one place.
- Keep secret-bearing nested content out of `ItemRef` while preserving stable reference metadata.
