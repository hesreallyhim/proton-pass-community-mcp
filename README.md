# proton-pass-community-mcp

`proton-pass-community-mcp` is a minimal MCP server that wraps selected `pass-cli` commands from Proton Pass.

Independent community project. Not affiliated with or endorsed by Proton AG.

It is designed as a thin integration layer:

- typed tool inputs with `zod`
- stdio transport for MCP clients

## Release 0.1 Tool Surface

Release 0.1 exposes read-oriented tools only:

| Tool                | Purpose                                           |
| ------------------- | ------------------------------------------------- |
| `view_session_info` | Session/account status from `pass-cli info`       |
| `view_user_info`    | User account details from `pass-cli user info`    |
| `check_status`      | Session/API preflight + CLI version compatibility |
| `list_vaults`       | List vaults                                       |
| `list_shares`       | List shares                                       |
| `list_items`        | List items by vault name or share ID              |
| `search_items`      | Search items by title                             |
| `view_item`         | View item by URI or selectors                     |

Mutative handlers remain in the codebase for future releases but are not registered by default in 0.1.

## Item Discovery Contract

`list_items` and `search_items` return token-efficient `ItemRef` objects in `structuredContent.items`:

```json
{
  "id": "string",
  "share_id": "string | null",
  "vault_id": "string | null",
  "title": "string | null",
  "display_title": "string",
  "state": "string | null",
  "create_time": "string | null",
  "modify_time": "string | null",
  "uri": "string | null"
}
```

`list_items` and `search_items` both support MCP pagination:

- Input fields:
  - `pageSize` (optional, `1..250`, default `100` for JSON output)
  - `cursor` (optional non-negative integer string offset, for example `"100"`)
- Behavior:
  - Response includes `items`, `pageSize`, `cursor`, `returned`, `total`, and `nextCursor`.
  - Use `nextCursor` in a follow-up call to fetch the next page.

`list_items` also forwards `filterType`, `filterState`, and `sortBy` to `pass-cli item list`.

`search_items` semantics:

- title-only search (`field: "title"`)
- matching modes: `contains`, `prefix`, `exact`
- optional `caseSensitive`

## Requirements

- Node.js `24` (`.nvmrc`)
- `pass-cli` installed and authenticated
- MCP client capable of stdio transport

## Run Locally

```bash
npm ci
npm run build
npm run dev
```

## Authentication Model

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

## Validation / QA

```bash
npm run check
```

## Notes

- This is not an official Proton project.
- This project currently targets Proton Pass via `pass-cli` only.
- See [ROADMAP.md](./ROADMAP.md) for planned features.
