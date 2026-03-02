# Release 0.1 Notes

## Summary

Release 0.1.0 establishes a read-focused MCP surface for Proton Pass discovery and retrieval workflows.

## Included Tools

1. `view_session_info`
2. `view_user_info`
3. `check_status`
4. `list_vaults`
5. `list_shares`
6. `list_items`
7. `search_items`
8. `view_item`

## Key Behaviors

1. `list_items` returns reference-only `ItemRef` entries in `structuredContent` (no full item contents).
2. `list_items` supports `filterType`, `filterState`, and `sortBy`.
3. `list_items` and `search_items` use MCP cursor pagination (`cursor`, `pageSize`, `nextCursor`).
4. `search_items` is title-based with `contains`, `prefix`, and `exact` matching plus optional case sensitivity.
5. `check_status` remains the recommended session preflight entrypoint.

## Scope Boundary

1. Mutative tool handlers are retained in the codebase for future releases.
2. Mutative tools are not registered in the default 0.1.0 MCP tool surface.

## Non-Goals for 0.1.0

2. Write/mutation operations.
3. Advanced operational helpers (`run`, `inject`, `ssh-agent`, attachment workflows).
