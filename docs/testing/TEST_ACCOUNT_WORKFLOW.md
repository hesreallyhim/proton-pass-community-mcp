---
name: test-account-workflow
description: Local and CI workflow for a disposable Proton Pass account used by development and integration testing.
---

# Test Account Workflow

## Goal

Use one disposable Proton Pass account for this repository's development and integration testing, while keeping normal day-to-day Proton usage separate.

Related planning documents:

1. `docs/testing/CODEX_MCP_AUTH_SPEC.md`
2. `docs/testing/CODEX_MCP_TEST_PLAN.md`
3. `docs/testing/THROWAWAY_DATA_PLAN.md`

## Supported Proton Pass CLI Login Methods

Based on Proton Pass CLI docs:

1. Web login: `pass-cli login`
2. Interactive login: `pass-cli login --interactive [USERNAME]`

Interactive login can be automated with:

- `PROTON_PASS_PASSWORD` or `PROTON_PASS_PASSWORD_FILE`
- `PROTON_PASS_TOTP` or `PROTON_PASS_TOTP_FILE` (if 2FA is enabled)
- `PROTON_PASS_EXTRA_PASSWORD` or `PROTON_PASS_EXTRA_PASSWORD_FILE` (if Pass extra password is enabled)

SSO and U2F/FIDO hardware-key login are web-login-only.

## MCP Integration Authentication Model

This MCP server does not implement a separate token-based authentication layer. It invokes `pass-cli` as a subprocess and inherits the server process environment.

Implications:

1. If `pass-cli` can authenticate in that environment, MCP tools can run.
2. If `pass-cli` cannot authenticate, MCP tools return auth errors and require login out-of-band.
3. Current Proton Pass CLI docs do not describe a static API token/PAT login mode for `pass-cli login`.

### Pattern A: Local persistent dev session (recommended)

Use a persistent repo-local session + filesystem key provider:

- `PROTON_PASS_SESSION_DIR=<repo>/.tmp/proton-pass-dev-session`
- `PROTON_PASS_KEY_PROVIDER=fs`

Login once, then run MCP repeatedly without re-entering credentials until session expiry/logout.

### Pattern B: CI non-interactive login

Use ephemeral session + env key provider:

- `PROTON_PASS_SESSION_DIR=$RUNNER_TEMP/proton-pass-dev-session`
- `PROTON_PASS_KEY_PROVIDER=env`
- `PROTON_PASS_ENCRYPTION_KEY=<ci-secret>`

Then authenticate with `pass-cli login --interactive` using environment/file inputs for password, TOTP, and extra password as required by the account.

### MCP client configuration example (local throwaway account)

```json
{
  "mcpServers": {
    "proton-pass-community-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/proton-pass-community-mcp/dist/index.js"],
      "env": {
        "PASS_CLI_BIN": "pass-cli",
        "PROTON_PASS_SESSION_DIR": "/absolute/path/to/proton-pass-mcp/.tmp/proton-pass-dev-session",
        "PROTON_PASS_KEY_PROVIDER": "fs",
        "PASS_CLI_ALLOW_VERSION_DRIFT": "true"
      }
    }
  }
}
```

## Local Workflow (Single Developer)

### 1. Use the repo wrapper for all project CLI calls

Use:

```bash
scripts/pass-dev.sh <pass-cli-args...>
```

This wrapper defaults to:

- `PROTON_PASS_SESSION_DIR=<repo>/.tmp/proton-pass-dev-session`
- `PROTON_PASS_KEY_PROVIDER=fs` (no OS keychain access by default)

The wrapper intentionally avoids the keyring backend in normal project usage.

- Allowed defaults: `fs` or `env`
- Escape hatch: `PASS_DEV_ALLOW_KEYRING=1 PASS_DEV_KEY_PROVIDER=keyring ...`

### 2. Authenticate once with the throwaway account

```bash
scripts/pass-dev.sh login
# or:
scripts/pass-dev.sh login --interactive throwaway-account-id
```

Verify:

```bash
scripts/pass-dev.sh info
scripts/pass-dev.sh user info --output json
```

### 3. Add an account preflight before integration/destructive runs

Set your expected throwaway account:

```bash
export PASS_DEV_EXPECTED_ACCOUNT=throwaway-account-id
```

Then run:

```bash
scripts/pass-dev-preflight.sh
```

This fails fast if the currently authenticated CLI account does not match the expected throwaway account.

## Desktop App and SSH Key Workflow

Your Proton Pass desktop app and `pass-cli` are different clients. This repository workflow is CLI-scoped and uses its own session directory, so it does not require day-to-day account switching in the desktop app.

Additionally, with `scripts/pass-dev.sh`, the CLI is configured to avoid keychain/keyring by default (`PROTON_PASS_KEY_PROVIDER=fs` unless explicitly changed). This applies only to CLI sessions launched through the wrapper and does not change desktop-app or browser-extension configuration.

For SSH:

1. Keep your existing system SSH agent flow as default.
2. If you test `pass-cli ssh-agent start`, use a custom socket path and export `SSH_AUTH_SOCK` only in that shell session.
3. Prefer `pass-cli ssh-agent load` into your existing agent when you want minimal disruption.

## Contributor Workflow (Future)

There is no documented static API token login mode in current CLI docs. Use one of these models:

1. Shared throwaway account credentials distributed out-of-band (lowest setup overhead, weaker attribution).
2. One dedicated test account per contributor (best attribution/isolation, more setup).

For either model:

- Never commit credentials.
- Keep project session dir isolated via `scripts/pass-dev.sh`.
- Require `scripts/pass-dev-preflight.sh` in any script that can mutate state.

## CI Workflow

Recommended CI env:

1. `PROTON_PASS_SESSION_DIR=$RUNNER_TEMP/proton-pass-dev-session`
2. `PROTON_PASS_KEY_PROVIDER=env`
3. `PROTON_PASS_ENCRYPTION_KEY` from CI secret store
4. Login via `pass-cli login --interactive <test-user>` with env/file-based password/TOTP/extra-password inputs
5. Run `scripts/pass-dev-preflight.sh <test-user-account-identifier>`
6. Run tests
7. Cleanup with `pass-cli logout` (or `pass-cli logout --force` fallback)

### GitHub Actions Template

This repository includes a manual workflow template:

- `.github/workflows/pass-cli-integration-manual.yml`

It is `workflow_dispatch` only and intended as an opt-in smoke/integration job for the throwaway account.

This repository also includes a manual drift check workflow:

- `.github/workflows/pass-cli-template-drift-weekly.yml`

It is `workflow_dispatch` only and checks whether `item create <type> --get-template` output drifts from the committed snapshot artifact.

Automation policy note:

1. Upstream version/tag change detection is handled by `.github/workflows/upstream-pass-cli-watch.yml`.
2. Template drift checks are now opt-in/manual to avoid long-lived weekly secrets operations.

Required GitHub Actions secrets:

1. `PROTON_PASS_USERNAME`
2. `PROTON_PASS_PASSWORD`
3. `PROTON_PASS_EXPECTED_ACCOUNT`
4. `PROTON_PASS_ENCRYPTION_KEY`

Optional secrets (only if the account requires them):

1. `PROTON_PASS_TOTP`
2. `PROTON_PASS_EXTRA_PASSWORD`

Template drift check commands:

1. `npm run pass:dev:template:drift`
2. `npm run pass:dev:template:snapshot:update` (only when intentionally accepting template changes)
3. `npm run pass:dev:template:probe` (empirical required/optional/nullability probe; no cleanup by default)
4. `npm run pass:dev:template:probe:additional-properties` (empirical unknown-key acceptance probe; no cleanup by default)

Rate-limit caution for probe runs:

1. Proton Pass CLI docs do not currently publish explicit rate-limit guarantees.
2. For repeated/large probe runs, add pacing: `node scripts/probe-item-create-template-contract.mjs --run --delay-ms=250`
3. Enable cleanup only when needed: `node scripts/probe-item-create-template-contract.mjs --run --cleanup`

## Provider Compatibility Validation (One-Time)

To remove guesswork, run a one-time manual validation across all providers you care about. Record outcomes in your own maintainer notes.

### A) Filesystem provider (`fs`) with repo-isolated session

1. `PASS_DEV_KEY_PROVIDER=fs scripts/pass-dev.sh login`
2. Restart terminal and run `scripts/pass-dev.sh info`
3. Confirm MCP tools operate in inspector/client
4. Run `scripts/pass-dev.sh logout`

Expected: stable, isolated project behavior; no keychain/keyring dependency.

### B) Keyring provider (`keyring`) compatibility check (optional)

1. `PASS_DEV_ALLOW_KEYRING=1 PASS_DEV_KEY_PROVIDER=keyring scripts/pass-dev.sh login`
2. Restart terminal and run `scripts/pass-dev.sh info`
3. Run a minimal MCP tool call
4. Run `scripts/pass-dev.sh logout`

Expected: CLI session persists/reloads via OS keychain/keyring and MCP still works.

### C) Environment provider (`env`) for CI parity

1. Set `PROTON_PASS_KEY_PROVIDER=env` and `PROTON_PASS_ENCRYPTION_KEY=<test-value>`
2. Authenticate with `scripts/pass-dev.sh login --interactive <user>`
3. Run `scripts/pass-dev.sh info` and one MCP tool call
4. Clear env and logout

Expected: no filesystem/keychain dependency; behavior suitable for ephemeral runners.

## Security and Reliability Notes

1. Environment variables are readable by other processes in the same session; use file-based inputs where possible for automation.
2. If you use `logout --force`, server-side session invalidation may not happen.
3. If you keep TOTP enabled on the throwaway account, fully unattended CI requires TOTP automation.
