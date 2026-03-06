---
name: tool-schema-plan
description: Canonical specification and phased roadmap for proton-pass-community-mcp tool contracts and naming conventions.
---

# MCP Tool Schema Plan

## Intent

This document defines the planned MCP tool surface for `proton-pass-community-mcp` with two goals:

1. Expose the applicable `pass-cli` command surface (command parity), excluding authentication lifecycle commands that are intentionally user-managed out-of-band.
2. Add MCP-native tools/contracts where raw CLI output is not LLM-efficient.

Primary optimization target: item discovery (`pass-cli item list`) should return lightweight references, not full item payloads.

## Design Rules

1. Tool names use snake_case without provider prefix and prefer natural-language order (for example `list_vaults`, `view_item`).
2. Write/mutation tools require explicit confirmation (`confirm: true`) and write gate (`ALLOW_WRITE=1`).
3. Read tools default to structured, token-efficient JSON in `structuredContent`.
4. When `structuredContent` is returned, also return a `TextContent` serialization of that same JSON object for backwards compatibility/interoperability. This is not a separate human-output mode from the CLI.
5. Listing/search tools return references, then callers use `view_item` for full content.
6. Release branches may retain non-release code paths, but only release-scoped tools are registered/exposed by default.
7. Authentication lifecycle (`pass-cli login`, `pass-cli logout`) remains out-of-band and is not exposed as MCP tools.
8. CLI binary lifecycle commands (for example `pass-cli update` / track switching) remain out-of-band and are not exposed as MCP tools.
9. Host SSH agent integration/lifecycle commands (`pass-cli ssh-agent *`) remain out-of-band and are not exposed as MCP tools.

## Shared Schemas

### `ItemRef` (canonical list/search object)

```json
{
  "id": "string",
  "share_id": "string",
  "vault_id": "string",
  "title": "string | null",
  "display_title": "string",
  "type": "string | null",
  "state": "string | null",
  "create_time": "string | null",
  "modify_time": "string | null",
  "uri": "pass://<share_id>/<id>"
}
```

Title fallback policy:

1. Use `content.title` when non-empty.
2. Otherwise set `title: null` and `display_title: "[untitled:<short-id>]"`.

Raw upstream shape reference (anonymized sample from `pass-cli item list --output json`):

```json
{
  "id": "itm_9f2a1c7e",
  "share_id": "shr_7d4b2e11",
  "vault_id": "vlt_4c6f8a90",
  "content": {
    "title": "Example Login Entry",
    "note": "Autosaved from redacted origin",
    "item_uuid": "uuid_3b5d7f91",
    "content": {
      "Login": {
        "email": "user+sample@example.invalid",
        "username": "example_user",
        "password": "REDACTED_SECRET",
        "urls": ["https://example.invalid/login"],
        "totp_uri": "",
        "passkeys": []
      }
    },
    "extra_fields": []
  },
  "state": "Active",
  "flags": [],
  "create_time": "2026-01-10T12:34:56Z",
  "modify_time": "2026-01-12T08:15:30Z"
}
```

Notes:

1. `content.content.<Type>` (for example `Login`) is used to derive `ItemRef.type` (normalized to filter token format, for example `login`).
2. Nested secret-bearing fields (passwords, TOTP URIs, passkeys, notes) must not be surfaced in `ItemRef`.

### `CursorPage<T>`

```json
{
  "items": "T[]",
  "cursor": "string",
  "pageSize": 100,
  "returned": 100,
  "total": 708,
  "nextCursor": "string | null"
}
```

Cursor is an offset string (`"0"`, `"100"`, ...).

### `InviteRef` (canonical invitation list object)

```json
{
  "id": "string",
  "type": "string | null",
  "target_name": "string | null",
  "inviter": "string | null",
  "role": "string | null",
  "state": "string | null",
  "create_time": "string | null"
}
```

Notes:

1. Treat invitation tokens as sensitive capabilities and do not expose them in list payloads.
2. Include only stable metadata needed for triage and follow-up selection.

### `VaultMemberRef` (canonical vault-member list object)

```json
{
  "id": "string",
  "username": "string | null",
  "email": "string | null",
  "role": "string | null",
  "state": "string | null",
  "create_time": "string | null"
}
```

## Item Discovery Contract

### `list_items` (planned v2 behavior)

Input:

1. Existing selectors: `vaultName` or `shareId`.
2. Existing filters: `filterType`, `filterState`, `sortBy`.
3. Pagination: `pageSize`, `cursor`.
4. Optional `output`, default `json`.

Output:

1. `structuredContent: CursorPage<ItemRef>`.
2. No full sensitive fields.
3. Optional compatibility flag `includeRawItem=false` (default `false`) if temporary transition is needed.

### `search_items` (MCP-native, not direct CLI parity)

Input:

1. `query` (required).
2. `field` (default and only supported value initially: `"title"`).
3. `match` enum: `contains | prefix | exact` (default `contains`).
4. `caseSensitive` boolean (default `false`).
5. `vaultName` or `shareId` optional selector.
6. `filterType`, `filterState`, `sortBy` passthrough.
7. `pageSize`, `cursor`.

Output:

1. `structuredContent: CursorPage<ItemRef>`.
2. `queryMeta` object with `field`, `match`, and `caseSensitive`.

Notes:

1. Search is explicitly title-based for v1.
2. If title is missing, item is still returned as a ref but cannot match title query except by empty/exact edge cases.

## Incremental Read Contracts (Pre-Write Track)

### `list_invites`

Input:

1. `pageSize`, `cursor`.

Output:

1. `structuredContent: CursorPage<InviteRef>`.
2. Reference-only invite metadata (no raw invite token material in list payloads).
3. When structured parsing is unavailable, return best-effort normalized text in `content`.

### `list_vault_members`

Input:

1. Scope selector: exactly one of `shareId` or `vaultName`.
2. `pageSize`, `cursor`.

Output:

1. `structuredContent: CursorPage<VaultMemberRef>`.
2. `scope` object echoing the selector used (`shareId` or `vaultName`).
3. When structured parsing is unavailable, return best-effort normalized text in `content`.

### `view_settings`

Input:

1. none.

Output:

1. `structuredContent` with parsed settings when machine-readable shape is derivable.
2. `content` remains present for debugging/interoperability.

## Planned Tool Inventory

Status key:

1. `Implemented`: currently in server.
2. `Planned`: targeted for schema/tool implementation.
3. `Planned (MCP-native)`: added for MCP ergonomics, not direct CLI command.
4. `Out of Scope (Out-of-Band)`: intentionally not exposed as MCP tools.

### Session and Utilities

| Tool                | Source                                 | Status                     | Input Summary                                          | Output Summary                                          |
| ------------------- | -------------------------------------- | -------------------------- | ------------------------------------------------------ | ------------------------------------------------------- |
| `login`             | `pass-cli login`                       | Out of Scope (Out-of-Band) | n/a                                                    | n/a                                                     |
| `logout`            | `pass-cli logout`                      | Out of Scope (Out-of-Band) | n/a                                                    | n/a                                                     |
| `check_status`      | `pass-cli test` + `pass-cli --version` | Implemented                | none                                                   | Connectivity/auth preflight + CLI version compatibility |
| `view_session_info` | `pass-cli info`                        | Implemented                | `output?`                                              | Account/session info                                    |
| `view_user_info`    | `pass-cli user info`                   | Implemented                | `output?`                                              | User profile                                            |
| `update`            | `pass-cli update`                      | Out of Scope (Out-of-Band) | n/a                                                    | n/a                                                     |
| `support`           | `pass-cli support`                     | Planned                    | none                                                   | Support guidance text                                   |
| `inject`            | `pass-cli inject`                      | Planned                    | `inFile`, `outFile?`, `fileMode?`, `force?`, `confirm` | Output path/status                                      |
| `run`               | `pass-cli run`                         | Planned                    | `command[]`, `envFile[]?`, `noMasking?`, `confirm`     | Exit code/stdout/stderr summary                         |

### Vault Tools

| Tool                  | Source                         | Status      | Input Summary                                              | Output Summary               |
| --------------------- | ------------------------------ | ----------- | ---------------------------------------------------------- | ---------------------------- |
| `list_vaults`         | `pass-cli vault list`          | Implemented | `output?`                                                  | Vault list                   |
| `create_vault`        | `pass-cli vault create`        | Implemented | `name`, `confirm`                                          | Created vault status         |
| `update_vault`        | `pass-cli vault update`        | Implemented | `shareId \| vaultName`, `newName`, `confirm`               | Update status                |
| `delete_vault`        | `pass-cli vault delete`        | Implemented | `shareId \| vaultName`, `confirm`                          | Delete status                |
| `vault_share`         | `pass-cli vault share`         | Planned     | `shareId \| vaultName`, `email`, `role?`, `confirm`        | Share result                 |
| `vault_transfer`      | `pass-cli vault transfer`      | Planned     | `shareId \| vaultName`, `memberShareId`, `confirm`         | Transfer result              |
| `list_vault_members`  | `pass-cli vault member list`   | Implemented | `shareId \| vaultName`, `pageSize?`, `cursor?`             | `CursorPage<VaultMemberRef>` |
| `vault_member_update` | `pass-cli vault member update` | Planned     | `shareId \| vaultName`, `memberShareId`, `role`, `confirm` | Update status                |
| `vault_member_remove` | `pass-cli vault member remove` | Planned     | `shareId \| vaultName`, `memberShareId`, `confirm`         | Remove status                |

### Item Discovery and Read

| Tool           | Source               | Status                        | Input Summary                                                                            | Output Summary                 |
| -------------- | -------------------- | ----------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------ |
| `list_items`   | `pass-cli item list` | Implemented (needs v2 schema) | `vaultName \| shareId`, `filterType?`, `filterState?`, `sortBy?`, `pageSize?`, `cursor?` | Planned: `CursorPage<ItemRef>` |
| `search_items` | MCP-native           | Planned (MCP-native)          | `query`, title-search params, selectors, filters, paging                                 | `CursorPage<ItemRef>`          |
| `view_item`    | `pass-cli item view` | Implemented                   | `uri` or selector tuple, `field?`, `output?`                                             | Full item or selected field    |
| `item_totp`    | `pass-cli item totp` | Planned                       | `uri` or selector tuple, `field?`, `output?`                                             | TOTP value(s)                  |

### Item Write and Lifecycle

| Tool           | Source                  | Status      | Input Summary                                                     | Output Summary |
| -------------- | ----------------------- | ----------- | ----------------------------------------------------------------- | -------------- |
| `update_item`  | `pass-cli item update`  | Implemented | selectors, `fields[]`, `confirm`                                  | Update status  |
| `item_move`    | `pass-cli item move`    | Planned     | source selector + destination selector + item selector, `confirm` | Move status    |
| `delete_item`  | `pass-cli item delete`  | Implemented | `shareId`, `itemId`, `confirm`                                    | Delete status  |
| `item_share`   | `pass-cli item share`   | Planned     | `shareId`, `itemId`, `email`, `role?`, `confirm`                  | Share status   |
| `item_trash`   | `pass-cli item trash`   | Planned     | selectors, `confirm`                                              | Trash status   |
| `item_untrash` | `pass-cli item untrash` | Planned     | selectors, `confirm`                                              | Restore status |

### Item Creation

| Tool                           | Source                                  | Status      | Input Summary                                   | Output Summary |
| ------------------------------ | --------------------------------------- | ----------- | ----------------------------------------------- | -------------- |
| `create_login_item`            | `pass-cli item create login`            | Implemented | typed login fields or template mode, `confirm`  | Created item   |
| `item_create_note`             | `pass-cli item create note`             | Planned     | note fields or template mode, `confirm`         | Created item   |
| `item_create_credit_card`      | `pass-cli item create credit-card`      | Planned     | card fields or template mode, `confirm`         | Created item   |
| `item_create_wifi`             | `pass-cli item create wifi`             | Planned     | wifi fields or template mode, `confirm`         | Created item   |
| `item_create_custom`           | `pass-cli item create custom`           | Planned     | template mode, `confirm`                        | Created item   |
| `item_create_identity`         | `pass-cli item create identity`         | Planned     | template mode, `confirm`                        | Created item   |
| `item_create_ssh_key_generate` | `pass-cli item create ssh-key generate` | Planned     | ssh generation fields, `confirm`                | Created item   |
| `item_create_ssh_key_import`   | `pass-cli item create ssh-key import`   | Planned     | key import fields, `confirm`                    | Created item   |
| `create_item_from_template`    | MCP wrapper around `--from-template -`  | Implemented | `itemType`, selector, `templateJson`, `confirm` | Created item   |

### Item Alias, Attachment, and Members

| Tool                       | Source                              | Status  | Input Summary                                                | Output Summary       |
| -------------------------- | ----------------------------------- | ------- | ------------------------------------------------------------ | -------------------- |
| `item_alias_create`        | `pass-cli item alias create`        | Planned | `shareId \| vaultName`, `prefix`, `output?`, `confirm`       | Alias item           |
| `item_attachment_download` | `pass-cli item attachment download` | Planned | `shareId`, `itemId`, `attachmentId`, `outputPath`, `confirm` | Download status/path |
| `item_member_list`         | `pass-cli item member list`         | Planned | `shareId`, `itemId`, `output?`                               | Member list          |
| `item_member_update`       | `pass-cli item member update`       | Planned | `shareId`, `memberShareId`, `role`, `confirm`                | Update status        |
| `item_member_remove`       | `pass-cli item member remove`       | Planned | `shareId`, `memberShareId`, `confirm`                        | Remove status        |

### Share, Invite, Password, TOTP, User, Settings, SSH Agent

| Tool                            | Source                                   | Status       | Input Summary                          | Output Summary            |
| ------------------------------- | ---------------------------------------- | ------------ | -------------------------------------- | ------------------------- |
| `list_shares`                   | `pass-cli share list`                    | Implemented  | `onlyItems?`, `onlyVaults?`, `output?` | Shares list               |
| `list_invites`                  | `pass-cli invite list`                   | Implemented  | `pageSize?`, `cursor?`                 | `CursorPage<InviteRef>`   |
| `invite_accept`                 | `pass-cli invite accept`                 | Planned      | `inviteId`, `confirm`                  | Accept status             |
| `invite_reject`                 | `pass-cli invite reject`                 | Planned      | `inviteId`, `confirm`                  | Reject status             |
| `generate_random_password`      | `pass-cli password generate random`      | Planned      | generation flags                       | Password value/metadata   |
| `generate_passphrase`           | `pass-cli password generate passphrase`  | Planned      | generation flags                       | Passphrase value/metadata |
| `score_password`                | `pass-cli password score`                | Planned      | `password`                             | Strength report           |
| `totp_generate`                 | `pass-cli totp generate`                 | Planned      | `secretOrUri`, `output?`               | TOTP value                |
| `view_settings`                 | `pass-cli settings view`                 | Implemented  | none                                   | Settings object           |
| `settings_set_default_vault`    | `pass-cli settings set default-vault`    | Planned      | `vaultName \| shareId`, `confirm`      | Set status                |
| `settings_set_default_format`   | `pass-cli settings set default-format`   | Planned      | `format`, `confirm`                    | Set status                |
| `settings_unset_default_vault`  | `pass-cli settings unset default-vault`  | Planned      | `confirm`                              | Unset status              |
| `settings_unset_default_format` | `pass-cli settings unset default-format` | Planned      | `confirm`                              | Unset status              |
| `ssh_agent_start`               | `pass-cli ssh-agent start`               | Out-of-SCope | N/A                                    | N/A                       |
| `ssh_agent_load`                | `pass-cli ssh-agent load`                | Out-of-SCope | N/A                                    | N/A                       |
| `ssh_agent_debug`               | `pass-cli ssh-agent debug`               | Out-of-SCope | N/A                                    | N/A                       |

## Phased Delivery

### Phase 1

1. Finish `list_items` v2 reference contract and fix payload-shape handling (`{items:[...]}`).
2. Add `filterType`, `filterState`, `sortBy` to `list_items`.
3. Add `search_items` (title-only search).

### Phase 2

1. Add parity wrappers for remaining read-focused commands.
2. Add parity wrappers for remaining write commands with confirmation gates.

### Phase 3

1. Add resources for high-read paths (`pass://vaults`, `pass://share/<id>/items`).
2. Keep tools for actions and targeted retrieval.

## Decisions

1. `list_items` response strategy: use ref-only now (Option A). Future compatibility expansions are conditional on concrete downstream tool-flow needs, not preemptive.
2. MCP output format policy: JSON-only for tool-facing responses. When upstream CLI offers human/json output modes, MCP tool handlers should select/normalize JSON and minimize fields for agent consumption.
