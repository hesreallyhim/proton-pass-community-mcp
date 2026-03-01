# MCP Tool Schema Plan

## Intent

This document defines the planned MCP tool surface for `proton-pass-mcp` with two goals:

1. Expose the full `pass-cli` command surface (command parity).
2. Add MCP-native tools/contracts where raw CLI output is not LLM-efficient.

Primary optimization target: item discovery (`pass-cli item list`) should return lightweight references, not full item payloads.

## Design Rules

1. Tool names use `pass_<command_path>` in snake_case.
2. Write/mutation tools require explicit confirmation (`confirm: true`) and write gate (`ALLOW_WRITE=1`).
3. Read tools default to structured, token-efficient JSON in `structuredContent`.
4. `content` text remains present for interoperability/debugging.
5. Listing/search tools return references, then callers use `pass_item_view` for full content.

## Shared Schemas

### `ItemRef` (canonical list/search object)

```json
{
  "id": "string",
  "share_id": "string",
  "vault_id": "string",
  "title": "string | null",
  "display_title": "string",
  "state": "string | null",
  "create_time": "string | null",
  "modify_time": "string | null",
  "uri": "pass://<share_id>/<id>"
}
```

Title fallback policy:

1. Use `content.title` when non-empty.
2. Otherwise set `title: null` and `display_title: "[untitled:<short-id>]"`.

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

## Item Discovery Contract

### `pass_item_list` (planned v2 behavior)

Input:

1. Existing selectors: `vaultName` or `shareId`.
2. Existing filters: `filterType`, `filterState`, `sortBy`.
3. Pagination: `pageSize`, `cursor`.
4. Optional `output`, default `json`.

Output:

1. `structuredContent: CursorPage<ItemRef>`.
2. No full sensitive fields.
3. Optional compatibility flag `includeRawItem=false` (default `false`) if temporary transition is needed.

### `pass_item_search` (MCP-native, not direct CLI parity)

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

## Planned Tool Inventory

Status key:

1. `Implemented`: currently in server.
2. `Planned`: targeted for schema/tool implementation.
3. `Planned (MCP-native)`: added for MCP ergonomics, not direct CLI command.

### Session and Utilities

| Tool           | Source             | Status      | Input Summary                                          | Output Summary                    |
| -------------- | ------------------ | ----------- | ------------------------------------------------------ | --------------------------------- |
| `pass_login`   | `pass-cli login`   | Planned     | `username?`, `interactive?`                            | Session/login result text or json |
| `pass_logout`  | `pass-cli logout`  | Planned     | `force?`, `confirm`                                    | Operation result                  |
| `pass_test`    | `pass-cli test`    | Implemented | none                                                   | Connectivity/session preflight    |
| `pass_info`    | `pass-cli info`    | Implemented | `output?`                                              | Account/session info              |
| `pass_update`  | `pass-cli update`  | Planned     | `yes?`, `setTrack?`, `confirm`                         | Update result                     |
| `pass_support` | `pass-cli support` | Planned     | none                                                   | Support guidance text             |
| `pass_inject`  | `pass-cli inject`  | Planned     | `inFile`, `outFile?`, `fileMode?`, `force?`, `confirm` | Output path/status                |
| `pass_run`     | `pass-cli run`     | Planned     | `command[]`, `envFile[]?`, `noMasking?`, `confirm`     | Exit code/stdout/stderr summary   |

### Vault Tools

| Tool                       | Source                         | Status      | Input Summary                                              | Output Summary       |
| -------------------------- | ------------------------------ | ----------- | ---------------------------------------------------------- | -------------------- |
| `pass_vault_list`          | `pass-cli vault list`          | Implemented | `output?`                                                  | Vault list           |
| `pass_vault_create`        | `pass-cli vault create`        | Implemented | `name`, `confirm`                                          | Created vault status |
| `pass_vault_update`        | `pass-cli vault update`        | Implemented | `shareId \| vaultName`, `newName`, `confirm`               | Update status        |
| `pass_vault_delete`        | `pass-cli vault delete`        | Implemented | `shareId \| vaultName`, `confirm`                          | Delete status        |
| `pass_vault_share`         | `pass-cli vault share`         | Planned     | `shareId \| vaultName`, `email`, `role?`, `confirm`        | Share result         |
| `pass_vault_transfer`      | `pass-cli vault transfer`      | Planned     | `shareId \| vaultName`, `memberShareId`, `confirm`         | Transfer result      |
| `pass_vault_member_list`   | `pass-cli vault member list`   | Planned     | `shareId \| vaultName`, `output?`                          | Member list          |
| `pass_vault_member_update` | `pass-cli vault member update` | Planned     | `shareId \| vaultName`, `memberShareId`, `role`, `confirm` | Update status        |
| `pass_vault_member_remove` | `pass-cli vault member remove` | Planned     | `shareId \| vaultName`, `memberShareId`, `confirm`         | Remove status        |

### Item Discovery and Read

| Tool               | Source               | Status                        | Input Summary                                                                            | Output Summary                 |
| ------------------ | -------------------- | ----------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------ |
| `pass_item_list`   | `pass-cli item list` | Implemented (needs v2 schema) | `vaultName \| shareId`, `filterType?`, `filterState?`, `sortBy?`, `pageSize?`, `cursor?` | Planned: `CursorPage<ItemRef>` |
| `pass_item_search` | MCP-native           | Planned (MCP-native)          | `query`, title-search params, selectors, filters, paging                                 | `CursorPage<ItemRef>`          |
| `pass_item_view`   | `pass-cli item view` | Implemented                   | `uri` or selector tuple, `field?`, `output?`                                             | Full item or selected field    |
| `pass_item_totp`   | `pass-cli item totp` | Planned                       | `uri` or selector tuple, `field?`, `output?`                                             | TOTP value(s)                  |

### Item Write and Lifecycle

| Tool                | Source                  | Status      | Input Summary                                                     | Output Summary |
| ------------------- | ----------------------- | ----------- | ----------------------------------------------------------------- | -------------- |
| `pass_item_update`  | `pass-cli item update`  | Implemented | selectors, `fields[]`, `confirm`                                  | Update status  |
| `pass_item_move`    | `pass-cli item move`    | Planned     | source selector + destination selector + item selector, `confirm` | Move status    |
| `pass_item_delete`  | `pass-cli item delete`  | Implemented | `shareId`, `itemId`, `confirm`                                    | Delete status  |
| `pass_item_share`   | `pass-cli item share`   | Planned     | `shareId`, `itemId`, `email`, `role?`, `confirm`                  | Share status   |
| `pass_item_trash`   | `pass-cli item trash`   | Planned     | selectors, `confirm`                                              | Trash status   |
| `pass_item_untrash` | `pass-cli item untrash` | Planned     | selectors, `confirm`                                              | Restore status |

### Item Creation

| Tool                                | Source                                  | Status      | Input Summary                                   | Output Summary |
| ----------------------------------- | --------------------------------------- | ----------- | ----------------------------------------------- | -------------- |
| `pass_item_create_login`            | `pass-cli item create login`            | Implemented | typed login fields or template mode, `confirm`  | Created item   |
| `pass_item_create_note`             | `pass-cli item create note`             | Planned     | note fields or template mode, `confirm`         | Created item   |
| `pass_item_create_credit_card`      | `pass-cli item create credit-card`      | Planned     | card fields or template mode, `confirm`         | Created item   |
| `pass_item_create_wifi`             | `pass-cli item create wifi`             | Planned     | wifi fields or template mode, `confirm`         | Created item   |
| `pass_item_create_custom`           | `pass-cli item create custom`           | Planned     | template mode, `confirm`                        | Created item   |
| `pass_item_create_identity`         | `pass-cli item create identity`         | Planned     | template mode, `confirm`                        | Created item   |
| `pass_item_create_ssh_key_generate` | `pass-cli item create ssh-key generate` | Planned     | ssh generation fields, `confirm`                | Created item   |
| `pass_item_create_ssh_key_import`   | `pass-cli item create ssh-key import`   | Planned     | key import fields, `confirm`                    | Created item   |
| `pass_item_create_from_template`    | MCP wrapper around `--from-template -`  | Implemented | `itemType`, selector, `templateJson`, `confirm` | Created item   |

### Item Alias, Attachment, and Members

| Tool                            | Source                              | Status  | Input Summary                                                | Output Summary       |
| ------------------------------- | ----------------------------------- | ------- | ------------------------------------------------------------ | -------------------- |
| `pass_item_alias_create`        | `pass-cli item alias create`        | Planned | `shareId \| vaultName`, `prefix`, `output?`, `confirm`       | Alias item           |
| `pass_item_attachment_download` | `pass-cli item attachment download` | Planned | `shareId`, `itemId`, `attachmentId`, `outputPath`, `confirm` | Download status/path |
| `pass_item_member_list`         | `pass-cli item member list`         | Planned | `shareId`, `itemId`, `output?`                               | Member list          |
| `pass_item_member_update`       | `pass-cli item member update`       | Planned | `shareId`, `memberShareId`, `role`, `confirm`                | Update status        |
| `pass_item_member_remove`       | `pass-cli item member remove`       | Planned | `shareId`, `memberShareId`, `confirm`                        | Remove status        |

### Share, Invite, Password, TOTP, User, Settings, SSH Agent

| Tool                                 | Source                                   | Status  | Input Summary                          | Output Summary            |
| ------------------------------------ | ---------------------------------------- | ------- | -------------------------------------- | ------------------------- |
| `pass_share_list`                    | `pass-cli share list`                    | Planned | `onlyItems?`, `onlyVaults?`, `output?` | Shares list               |
| `pass_invite_list`                   | `pass-cli invite list`                   | Planned | `output?`                              | Invite list               |
| `pass_invite_accept`                 | `pass-cli invite accept`                 | Planned | `inviteId`, `confirm`                  | Accept status             |
| `pass_invite_reject`                 | `pass-cli invite reject`                 | Planned | `inviteId`, `confirm`                  | Reject status             |
| `pass_password_generate_random`      | `pass-cli password generate random`      | Planned | generation flags, `output?`            | Password value/metadata   |
| `pass_password_generate_passphrase`  | `pass-cli password generate passphrase`  | Planned | generation flags, `output?`            | Passphrase value/metadata |
| `pass_password_score`                | `pass-cli password score`                | Planned | `password`, `output?`                  | Strength report           |
| `pass_totp_generate`                 | `pass-cli totp generate`                 | Planned | `secretOrUri`, `output?`               | TOTP value                |
| `pass_user_info`                     | `pass-cli user info`                     | Planned | `output?`                              | User profile              |
| `pass_settings_view`                 | `pass-cli settings view`                 | Planned | none                                   | Settings object           |
| `pass_settings_set_default_vault`    | `pass-cli settings set default-vault`    | Planned | `vaultName \| shareId`, `confirm`      | Set status                |
| `pass_settings_set_default_format`   | `pass-cli settings set default-format`   | Planned | `format`, `confirm`                    | Set status                |
| `pass_settings_unset_default_vault`  | `pass-cli settings unset default-vault`  | Planned | `confirm`                              | Unset status              |
| `pass_settings_unset_default_format` | `pass-cli settings unset default-format` | Planned | `confirm`                              | Unset status              |
| `pass_ssh_agent_start`               | `pass-cli ssh-agent start`               | Planned | CLI flags passthrough, `confirm`       | Agent status              |
| `pass_ssh_agent_load`                | `pass-cli ssh-agent load`                | Planned | CLI flags passthrough, `confirm`       | Load status               |
| `pass_ssh_agent_debug`               | `pass-cli ssh-agent debug`               | Planned | selectors, `output?`                   | Debug report              |

## Phased Delivery

### Phase 1

1. Finish `pass_item_list` v2 reference contract and fix payload-shape handling (`{items:[...]}`).
2. Add `filterType`, `filterState`, `sortBy` to `pass_item_list`.
3. Add `pass_item_search` (title-only search).

### Phase 2

1. Add parity wrappers for remaining read-focused commands.
2. Add parity wrappers for remaining write commands with confirmation gates.

### Phase 3

1. Add resources for high-read paths (`pass://vaults`, `pass://share/<id>/items`).
2. Keep tools for actions and targeted retrieval.

## Open Questions

1. Compatibility strategy for `pass_item_list` response change:
   Option A: break to ref-only now.
   Option B: transition with `includeRawItem`.
2. Whether to split non-JSON outputs into dedicated `*_human` tools or keep `output` enum on all parity wrappers.
