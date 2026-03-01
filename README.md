# proton-pass-mcp

`proton-pass-mcp` is a minimal MCP server that wraps selected `pass-cli` commands from Proton Pass.

It is designed as a thin integration layer:

- typed tool inputs with `zod`
- explicit write gating (`ALLOW_WRITE=1` + `"confirm": true`)
- stdio transport for MCP clients

## Current Tool Surface

| Tool                        | Purpose                                           |
| --------------------------- | ------------------------------------------------- |
| `view_session_info`         | Session/account status from `pass-cli info`       |
| `view_user_info`            | User account details from `pass-cli user info`    |
| `check_status`              | Session/API preflight + CLI version compatibility |
| `list_vaults`               | List vaults                                       |
| `list_items`                | List items by vault name or share ID              |
| `view_item`                 | View item by URI or selectors                     |
| `create_vault`              | Create vault (write)                              |
| `update_vault`              | Rename vault (write)                              |
| `delete_vault`              | Delete vault (write)                              |
| `create_login_item`         | Create login item (write)                         |
| `create_item_from_template` | Create item from JSON template (write)            |
| `update_item`               | Update item fields (write)                        |
| `delete_item`               | Delete item (write)                               |

## `list_items` Pagination

`pass-cli item list` does not expose native paging flags, so this server paginates JSON output in-process.

- Input fields:
  - `pageSize` (optional, `1..250`, default `100` for JSON output)
  - `cursor` (optional non-negative integer string offset, for example `"100"`)
- Behavior:
  - Pagination is supported only with `{"output":"json"}`.
  - Response includes `structuredContent` with `items`, `pageSize`, `cursor`, `returned`, `total`, and `nextCursor`.
  - Use `nextCursor` in a follow-up `list_items` call to fetch the next page.

## Requirements

- Node.js `22` (`.nvmrc`)
- `pass-cli` installed and authenticated
- MCP client capable of stdio transport

## Run Locally

```bash
npm ci
npm run build
npm run dev
```

## Safety Model

Write tools are blocked unless:

1. `ALLOW_WRITE=1` is set in the server environment
2. the tool call includes `"confirm": true`

This protects against accidental destructive calls.

Authentication handling:

1. Authentication is user-managed outside MCP with `pass-cli login`.
2. On auth failure, tools return standardized `AUTH_*` errors and a retry instruction.
3. The MCP server does not collect credentials, OTP codes, or private keys.
4. Use `check_status` once as a session preflight (not per tool call); rely on `AUTH_*` fallback errors if the session later expires.
5. `check_status` enforces CLI compatibility against pinned `pass-cli` `1.5.2` by default:
   - patch mismatch: warn
   - higher minor (same major): warn
   - lower minor (same major): error
   - major mismatch: error

## Environment Variables

- `PASS_CLI_BIN`: override CLI binary path/name (default `pass-cli`)
- `PASS_CLI_PINNED_VERSION`: override pinned compatibility baseline for `check_status` (default `1.5.2`)
- `ALLOW_WRITE`: enable write tools when set to `1`

## Validation / QA

```bash
npm run check
npm run mcp:inspect:smoke
```

## Notes

- This is not an official Proton project.
- This project currently targets Proton Pass via `pass-cli` only.
- See [ROADMAP.md](./ROADMAP.md) for planned features.
