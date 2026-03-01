# proton-pass-mcp

`proton-pass-mcp` is a minimal MCP server that wraps selected `pass-cli` commands from Proton Pass.

It is designed as a thin integration layer:

- typed tool inputs with `zod`
- explicit write gating (`ALLOW_WRITE=1` + `"confirm": true`)
- stdio transport for MCP clients

## Current Tool Surface

| Tool                             | Purpose                                     |
| -------------------------------- | ------------------------------------------- |
| `pass_info`                      | Session/account status from `pass-cli info` |
| `pass_test`                      | Session/API connectivity preflight          |
| `pass_vault_list`                | List vaults                                 |
| `pass_item_list`                 | List items by vault name or share ID        |
| `pass_item_view`                 | View item by URI or selectors               |
| `pass_vault_create`              | Create vault (write)                        |
| `pass_vault_update`              | Rename vault (write)                        |
| `pass_vault_delete`              | Delete vault (write)                        |
| `pass_item_create_login`         | Create login item (write)                   |
| `pass_item_create_from_template` | Create item from JSON template (write)      |
| `pass_item_update`               | Update item fields (write)                  |
| `pass_item_delete`               | Delete item (write)                         |

## `pass_item_list` Pagination

`pass-cli item list` does not expose native paging flags, so this server paginates JSON output in-process.

- Input fields:
  - `pageSize` (optional, `1..250`, default `100` for JSON output)
  - `cursor` (optional non-negative integer string offset, for example `"100"`)
- Behavior:
  - Pagination is supported only with `{"output":"json"}`.
  - Response includes `structuredContent` with `items`, `pageSize`, `cursor`, `returned`, `total`, and `nextCursor`.
  - Use `nextCursor` in a follow-up `pass_item_list` call to fetch the next page.

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
4. Use `pass_test` once as a session preflight (not per tool call); rely on `AUTH_*` fallback errors if the session later expires.

## Environment Variables

- `PASS_CLI_BIN`: override CLI binary path/name (default `pass-cli`)
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
