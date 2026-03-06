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
2. Current implementation requires explicit confirmation (`confirm: true`) and write gate (`ALLOW_WRITE=1`); see policy proposal below for elicitation-first migration.
3. Read tools default to structured, token-efficient JSON in `structuredContent`.
4. When `structuredContent` is returned, also return a `TextContent` serialization of that same JSON object for backwards compatibility/interoperability. This is not a separate human-output mode from the CLI.
5. Listing/search tools return references, then callers use `view_item` for full content.
6. Release branches may retain non-release code paths, but only release-scoped tools are registered/exposed by default.
7. Authentication lifecycle (`pass-cli login`, `pass-cli logout`) remains out-of-band and is not exposed as MCP tools.
8. CLI binary lifecycle commands (for example `pass-cli update` / track switching) remain out-of-band and are not exposed as MCP tools.
9. Host SSH agent integration/lifecycle commands (`pass-cli ssh-agent *`) remain out-of-band and are not exposed as MCP tools.

## Write Authorization and Confirmation Policy (Proposal)

This section defines the target mutation-safety model for this server, aligned with current MCP protocol semantics:

1. `ALLOW_WRITE=1` is the hard, server-side write gate and remains mandatory.
2. Tool annotations (for example `destructiveHint`) are advisory UX metadata only and are not treated as a security boundary.
3. For destructive tools, the server should request runtime user confirmation via MCP elicitation (`elicitation/create`) when the negotiated client capability supports it.
4. If elicitation is unavailable, interactive sessions should fail closed for destructive operations.
5. CI/non-interactive automation may opt in with an explicit override environment variable (proposed: `ALLOW_NONINTERACTIVE_WRITE=1`) for throwaway-account workflows.
6. The existing input-level `confirm` parameter is an implementation fallback and should be phased out once elicitation coverage is in place for supported hosts.

### Protocol Version and Capability Notes

1. Elicitation is not a universal requirement across all protocol versions.
2. Elicitation was introduced in spec version `2025-06-18`; sessions negotiating older versions cannot use it.
3. Even on current spec versions, elicitation is capability-negotiated and optional at runtime; servers must branch behavior based on negotiated capabilities.
4. For local `stdio` deployments, the same person usually controls both sides (client config and server process environment), so write-gate env vars are effectively user-chosen launch policy. This does not weaken enforcement: the server still applies its own gate checks at runtime.

### Decision Matrix (Target Behavior)

| Context                                                                            | Behavior                                                |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Read-only tool                                                                     | Execute normally                                        |
| Mutating tool + `ALLOW_WRITE!=1`                                                   | Deny (`WRITE_DISABLED`)                                 |
| Mutating tool + `ALLOW_WRITE=1` + client supports elicitation                      | Prompt via elicitation; execute only on explicit accept |
| Mutating tool + `ALLOW_WRITE=1` + no elicitation + `ALLOW_NONINTERACTIVE_WRITE!=1` | Deny (`WRITE_CONFIRMATION_UNAVAILABLE`)                 |
| Mutating tool + `ALLOW_WRITE=1` + no elicitation + `ALLOW_NONINTERACTIVE_WRITE=1`  | Execute (CI/non-interactive throwaway-account mode)     |

### Migration Plan

1. Keep current `confirm`-based behavior while adding elicitation-backed flows.
2. Prefer elicitation path when available; retain `confirm` only as temporary compatibility shim.
3. Remove `confirm` from mutating tool schemas after host compatibility validation and test coverage are complete.

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

## Resource Inventory

Status key:

1. `Implemented`: currently registered as MCP resources.
2. `Planned`: not yet registered.

| Resource URI Prefix                   | Status      | Source                                                                 | Notes                                                                                     |
| ------------------------------------- | ----------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `pass://templates/item-create`        | Implemented | Snapshot artifact (`docs/testing/item-create-templates.snapshot.json`) | Catalog/index resource                                                                    |
| `pass://templates/item-create/<type>` | Implemented | Snapshot artifact (`docs/testing/item-create-templates.snapshot.json`) | Per-type template resource (`login`, `note`, `credit-card`, `wifi`, `custom`, `identity`) |
| `pass://vaults`                       | Planned     | MCP-native                                                             | High-read vault listing                                                                   |
| `pass://share/<id>/items`             | Planned     | MCP-native                                                             | High-read item refs                                                                       |

## Planned Tool Inventory

Status key:

1. `Implemented`: currently in server.
2. `Planned`: targeted for schema/tool implementation.
3. `Planned (MCP-native)`: added for MCP ergonomics, not direct CLI command.
4. `Out of Scope (Out-of-Band)`: intentionally not exposed as MCP tools.

Input summary convention:

1. `required:` fields required by MCP tool contract/runtime gate.
2. `optional:` accepted but not required.
3. `selector:` scope selector semantics (`shareId | vaultName` etc.).
4. `xor:` mutually exclusive groups (exactly one when provided).

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
| `inject`            | `pass-cli inject`                      | Implemented                | `inFile`, `outFile?`, `fileMode?`, `force?`, `confirm` | Output path/status                                      |
| `run`               | `pass-cli run`                         | Implemented                | `command[]`, `envFile[]?`, `noMasking?`, `confirm`     | Exit code/stdout/stderr summary                         |

### Vault Tools

| Tool                  | Source                         | Status      | Input Summary                                              | Output Summary               |
| --------------------- | ------------------------------ | ----------- | ---------------------------------------------------------- | ---------------------------- |
| `list_vaults`         | `pass-cli vault list`          | Implemented | `output?`                                                  | Vault list                   |
| `create_vault`        | `pass-cli vault create`        | Implemented | `name`, `confirm`                                          | Created vault status         |
| `update_vault`        | `pass-cli vault update`        | Implemented | `shareId \| vaultName`, `newName`, `confirm`               | Update status                |
| `delete_vault`        | `pass-cli vault delete`        | Implemented | `shareId \| vaultName`, `confirm`                          | Delete status                |
| `share_vault`         | `pass-cli vault share`         | Implemented | `shareId \| vaultName`, `email`, `role?`, `confirm`        | Share result                 |
| `transfer_vault`      | `pass-cli vault transfer`      | Implemented | `shareId \| vaultName`, `memberShareId`, `confirm`         | Transfer result              |
| `list_vault_members`  | `pass-cli vault member list`   | Implemented | `shareId \| vaultName`, `pageSize?`, `cursor?`             | `CursorPage<VaultMemberRef>` |
| `update_vault_member` | `pass-cli vault member update` | Implemented | `shareId \| vaultName`, `memberShareId`, `role`, `confirm` | Update status                |
| `remove_vault_member` | `pass-cli vault member remove` | Implemented | `shareId \| vaultName`, `memberShareId`, `confirm`         | Remove status                |

### Item Discovery and Read

| Tool                 | Source               | Status                        | Input Summary                                                                            | Output Summary                 |
| -------------------- | -------------------- | ----------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------ |
| `list_items`         | `pass-cli item list` | Implemented (needs v2 schema) | `vaultName \| shareId`, `filterType?`, `filterState?`, `sortBy?`, `pageSize?`, `cursor?` | Planned: `CursorPage<ItemRef>` |
| `search_items`       | MCP-native           | Implemented (MCP-native)      | `query`, title-search params, selectors, filters, paging                                 | `CursorPage<ItemRef>`          |
| `view_item`          | `pass-cli item view` | Implemented                   | `uri` or selector tuple, `field?`, `output?`                                             | Full item or selected field    |
| `generate_item_totp` | `pass-cli item totp` | Implemented                   | `uri` or selector tuple, `field?`, `output?`                                             | TOTP value(s)                  |

### Item Write and Lifecycle

| Tool           | Source                  | Status      | Input Summary                                                             | Output Summary           |
| -------------- | ----------------------- | ----------- | ------------------------------------------------------------------------- | ------------------------ | -------------------------- | ------------- |
| `update_item`  | `pass-cli item update`  | Implemented | required: `fields[]`, `confirm`; selector: `shareId                       | vaultName`; xor: `itemId | itemTitle`; optional: none | Update status |
| `move_item`    | `pass-cli item move`    | Planned     | required: `confirm`; selector: source + destination + item selector (TBD) | Move status              |
| `delete_item`  | `pass-cli item delete`  | Implemented | required: `shareId`, `itemId`, `confirm`; optional: none                  | Delete status            |
| `share_item`   | `pass-cli item share`   | Implemented | required: `shareId`, `itemId`, `email`, `confirm`; optional: `role`       | Share status             |
| `trash_item`   | `pass-cli item trash`   | Planned     | required: `confirm`; selector: item selector (TBD)                        | Trash status             |
| `untrash_item` | `pass-cli item untrash` | Planned     | required: `confirm`; selector: item selector (TBD)                        | Restore status           |

### Item Creation

| Tool                              | Source                                          | Status                     | Input Summary                                                                                                                                                                 | Output Summary |
| --------------------------------- | ----------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `create_login_item`               | `pass-cli item create login`                    | Implemented                | required: `title`, `confirm`; optional: selector (`shareId` or `vaultName`), `username`, `email`, `password`, `url`, `generatePassword`, `output`                             | Created item   |
| `create_login_item_from_template` | `pass-cli item create login --from-template`    | Implemented                | required: `template.title`, `confirm`; optional: selector (`shareId` or `vaultName`), `template.username`, `template.email`, `template.password`, `template.urls[]`, `output` | Created item   |
| `create_note_item`                | `pass-cli item create note`                     | Implemented                | required: `title`, `confirm`; optional: selector (`shareId` or `vaultName`), `note`                                                                                           | Created item   |
| `create_credit_card_item`         | `pass-cli item create credit-card`              | Implemented                | required: `title`, `confirm`; optional: selector (`shareId` or `vaultName`), `cardholderName`, `number`, `cvv`, `expirationDate`, `pin`, `note`                               | Created item   |
| `create_wifi_item`                | `pass-cli item create wifi`                     | Implemented                | required: `title`, `ssid`, `confirm`; optional: selector (`shareId` or `vaultName`), `password`, `security`, `note`                                                           | Created item   |
| `create_custom_item`              | `pass-cli item create custom --from-template`   | Implemented                | required: `template.title`, `confirm`; optional: selector (`shareId` or `vaultName`), `template.note`, `template.sections[]`                                                  | Created item   |
| `create_identity_item`            | `pass-cli item create identity --from-template` | Implemented                | required: `template.title`, `confirm`; optional: selector (`shareId` or `vaultName`), template identity fields                                                                | Created item   |
| `generate_ssh_key_item`           | `pass-cli item create ssh-key generate`         | Out of Scope (Out-of-Band) | n/a                                                                                                                                                                           | n/a            |
| `import_ssh_key_item`             | `pass-cli item create ssh-key import`           | Out of Scope (Out-of-Band) | n/a                                                                                                                                                                           | n/a            |

Notes:

1. Docs verification (snapshot `v1.5.2` and `protonpass.github.io`, checked on March 6, 2026): explicit template schema examples are login-centric upstream.
2. Empirical validation against the throwaway account on March 6, 2026 (`scripts/pass-dev.sh`) confirmed `--get-template` and `--from-template` support for `note`, `credit-card`, `custom`, `wifi`, and `identity` (in addition to `login`).
3. Inferred per-type template contracts are documented in `docs/testing/ITEM_CREATE_TEMPLATE_SCHEMA_INFERENCE.md` and should be treated as tested working contracts, not authoritative upstream schema guarantees.
4. `item create <type> --get-template` outputs should be treated as templates/examples, not strict schemas; `wifi` template defaults are a concrete case where baseline output is not directly create-ready.
5. Additional-properties probe (March 6, 2026): unknown template keys are accepted by parser/create flow across tested types, but spot-check persistence indicates they are ignored/dropped; MCP contracts should not assume unknown keys become stored fields.
6. Template-backed creation tools (`create_login_item_from_template`, `create_custom_item`, `create_identity_item`) use explicit strict schemas (`additionalProperties: false` behavior at MCP validation layer).
7. `item create login --get-template` is currently out-of-band (not exposed as an MCP tool).

### Item Alias, Attachment, and Members

| Tool                       | Source                              | Status      | Input Summary                                                | Output Summary       |
| -------------------------- | ----------------------------------- | ----------- | ------------------------------------------------------------ | -------------------- |
| `create_item_alias`        | `pass-cli item alias create`        | Implemented | `shareId \| vaultName`, `prefix`, `output?`, `confirm`       | Alias item           |
| `download_item_attachment` | `pass-cli item attachment download` | Planned     | `shareId`, `itemId`, `attachmentId`, `outputPath`, `confirm` | Download status/path |
| `list_item_members`        | `pass-cli item member list`         | Planned     | `shareId`, `itemId`, `output?`                               | Member list          |
| `update_item_member`       | `pass-cli item member update`       | Planned     | `shareId`, `memberShareId`, `role`, `confirm`                | Update status        |
| `remove_item_member`       | `pass-cli item member remove`       | Planned     | `shareId`, `memberShareId`, `confirm`                        | Remove status        |

### Share, Invite, Password, TOTP, User, Settings, SSH Agent

| Tool                       | Source                                   | Status                     | Input Summary                          | Output Summary            |
| -------------------------- | ---------------------------------------- | -------------------------- | -------------------------------------- | ------------------------- |
| `list_shares`              | `pass-cli share list`                    | Implemented                | `onlyItems?`, `onlyVaults?`, `output?` | Shares list               |
| `list_invites`             | `pass-cli invite list`                   | Implemented                | `pageSize?`, `cursor?`                 | `CursorPage<InviteRef>`   |
| `accept_invite`            | `pass-cli invite accept`                 | Implemented                | `inviteToken`, `confirm`               | Accept status             |
| `reject_invite`            | `pass-cli invite reject`                 | Implemented                | `inviteToken`, `confirm`               | Reject status             |
| `generate_random_password` | `pass-cli password generate random`      | Implemented                | generation flags                       | Password value/metadata   |
| `generate_passphrase`      | `pass-cli password generate passphrase`  | Implemented                | generation flags                       | Passphrase value/metadata |
| `score_password`           | `pass-cli password score`                | Implemented                | `password`                             | Strength report           |
| `generate_totp`            | `pass-cli totp generate`                 | Planned                    | `secretOrUri`, `output?`               | TOTP value                |
| `view_settings`            | `pass-cli settings view`                 | Implemented                | none                                   | Settings object           |
| `set_default_vault`        | `pass-cli settings set default-vault`    | Implemented                | `vaultName \| shareId`, `confirm`      | Set status                |
| `unset_default_vault`      | `pass-cli settings unset default-vault`  | Implemented                | `confirm`                              | Unset status              |
| `set_default_format`       | `pass-cli settings set default-format`   | Out of Scope (Out-of-Band) | n/a                                    | n/a                       |
| `unset_default_format`     | `pass-cli settings unset default-format` | Out of Scope (Out-of-Band) | n/a                                    | n/a                       |
| `ssh_agent_start`          | `pass-cli ssh-agent start`               | Out of Scope (Out-of-Band) | n/a                                    | n/a                       |
| `ssh_agent_load`           | `pass-cli ssh-agent load`                | Out of Scope (Out-of-Band) | n/a                                    | n/a                       |
| `ssh_agent_debug`          | `pass-cli ssh-agent debug`               | Out of Scope (Out-of-Band) | n/a                                    | n/a                       |

Notes:

1. Output format defaults are intentionally user/workflow configuration and are not exposed as MCP tools. MCP tools should return structured outputs independent of CLI human/json display preferences.

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
