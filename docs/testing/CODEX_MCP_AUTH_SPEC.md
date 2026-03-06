---
name: codex-mcp-auth-spec
description: Authentication architecture and operating model for Proton Pass MCP usage in Codex and MCP Inspector.
---

# Codex MCP Authentication Spec

## Objective

Define a stable, low-friction authentication model for using this MCP server in:

1. Codex agent sessions
2. MCP Inspector sessions
3. CI integration checks

The model must prioritize the disposable Proton Pass account and avoid coupling to personal desktop-app/browser usage.

## Scope

In scope:

1. MCP server auth behavior as derived from `pass-cli`
2. Codex and Inspector runtime configuration patterns
3. Provider strategy for local and CI (`fs`, `env`, optional `keyring`)
4. Required guardrails for throwaway-account-only testing

Out of scope:

1. Designing new Proton auth protocols
2. Introducing server-managed credential collection in MCP tools
3. Enabling production-vault usage in automated tests

## Authentication Facts (Current State)

1. This MCP server does not implement its own token auth layer.
2. It executes `pass-cli` and inherits auth/session state from process environment.
3. Proton Pass CLI docs currently describe:
   - web login: `pass-cli login`
   - interactive login: `pass-cli login --interactive [USERNAME]`
4. Proton docs do not currently describe static PAT/API-token login for `pass-cli`.

## Architecture and Boundaries

1. `pass-cli` remains the only auth authority for this MCP integration.
2. MCP tools never receive/store account password, TOTP, or extra password as tool inputs.
3. Session storage and key provider are environment-controlled (`PROTON_PASS_SESSION_DIR`, `PROTON_PASS_KEY_PROVIDER`).
4. Desktop app/browser extension auth state is treated as independent from this CLI-scoped workflow.

## Standard Modes

### Mode A: Local Codex/Inspector Development (default)

1. Provider: `PROTON_PASS_KEY_PROVIDER=fs`
2. Session dir: repo-local `PROTON_PASS_SESSION_DIR=<repo>/.tmp/proton-pass-dev-session`
3. Login: `scripts/pass-dev.sh login` or `scripts/pass-dev.sh login --interactive <user>`
4. Guardrail: `scripts/pass-dev-preflight.sh` before mutative integration checks

Rationale:

1. Isolation from other repos/tools
2. No default keychain/keyring dependence
3. Repeatable behavior across shells and MCP clients

### Mode B: CI Integration

1. Provider: `PROTON_PASS_KEY_PROVIDER=env`
2. Encryption key: `PROTON_PASS_ENCRYPTION_KEY` from CI secret storage
3. Session dir: ephemeral runner path (`$RUNNER_TEMP/...`)
4. Login: `pass-cli login --interactive <user>` with env/file-fed credentials
5. Cleanup: logout best-effort

Rationale:

1. No machine keychain dependency
2. Compatible with ephemeral runners
3. Controlled secret handling in CI platform

### Mode C: Keyring Compatibility (optional verification lane)

1. Provider: `keyring`
2. Explicit opt-in only (`PASS_DEV_ALLOW_KEYRING=1`)
3. Not the default development mode

Rationale:

1. Compatibility confidence for user environments that prefer OS keychain
2. Keeps default workflow deterministic and isolated

## Codex and Inspector Configuration Pattern

### Codex project-scoped MCP configuration (recommended)

Add per-project `.codex/config.toml`:

```toml
[mcp_servers.proton_pass]
command = "node"
args = ["/Users/hesreallyhim/coding/projects/proton-pass-mcp/dist/index.js"]
cwd = "/Users/hesreallyhim/coding/projects/proton-pass-mcp"

[mcp_servers.proton_pass.env]
PASS_CLI_BIN = "pass-cli"
PROTON_PASS_SESSION_DIR = "/Users/hesreallyhim/coding/projects/proton-pass-mcp/.tmp/proton-pass-dev-session"
PROTON_PASS_KEY_PROVIDER = "fs"
PASS_CLI_ALLOW_VERSION_DRIFT = "true"
```

### Inspector pattern

1. Launch inspector with the same env values as Codex mode.
2. Validate `tools/list` and authenticated tool calls after login.

## Required Guardrails

1. Throwaway-account preflight is mandatory before destructive or integration test flows.
2. Never commit credentials or reusable authentication artifacts.
3. Keep CLI auth scoped to test-only vault/data.
4. Prefer manual, explicit enabling of integration checks in CI (`workflow_dispatch`) until stabilized.

## Test Data Lifecycle Requirement

Auth validation and integration testing should include a deterministic throwaway-data lifecycle:

1. hydrate known synthetic data
2. run checks against that data
3. optionally reset and rehydrate
4. produce metadata snapshots for debugging/regression evidence

Detailed planning for this is tracked in `docs/testing/THROWAWAY_DATA_PLAN.md`.

## Expected Behavior by State

1. Unauthenticated:
   - MCP tool call should fail with standardized auth classification.
2. Authenticated:
   - `check_status`, `view_session_info`, `view_user_info`, and read-only list/view operations should succeed.
3. Wrong account:
   - Preflight should fail and block test flow.
4. Session expired/logged out:
   - Tool calls should return auth failure until re-login.

## Open Questions

1. Whether future Proton CLI releases add token-like login methods.
2. Whether Codex runtime should include per-project MCP config in this repo or remain documented-only.
3. Whether keyring compatibility should become required versus optional.

## Source References

1. `docs/testing/TEST_ACCOUNT_WORKFLOW.md`
2. `.github/workflows/pass-cli-integration-manual.yml`
3. Proton Pass CLI login/configuration docs (upstream)
