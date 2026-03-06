---
name: codex-mcp-test-plan
description: Test matrix and execution plan for Proton Pass MCP authentication in CLI, Inspector, and Codex agent environments.
---

# Codex MCP Authentication Test Plan

## Goal

Validate that authentication behavior is correct and consistent across:

1. direct CLI usage
2. MCP Inspector
3. Codex agent MCP usage
4. CI smoke/integration workflow

## Preconditions

1. Throwaway Proton account exists and is dedicated to non-production test data.
2. `pass-cli` is installed locally.
3. Local environment has this repo checked out and built.
4. Guardrails scripts exist:
   - `scripts/pass-dev.sh`
   - `scripts/pass-dev-preflight.sh`
5. CI secrets are configured for manual workflow execution.

## Test Lanes

### Lane 0: Dataset Hydration and Reset

Purpose:

1. validate that disposable test data can be re-created on demand

Cases:

1. `SEED-HYDRATE-MINIMAL`
   - setup: throwaway account authenticated and preflight passing
   - action: run planned seed hydration workflow
   - expected: required vaults/items exist with deterministic sentinel markers
2. `SEED-RESET-REHYDRATE`
   - setup: hydrated dataset present
   - action: run reset, then hydrate again
   - expected: target dataset reconstructed cleanly
3. `SEED-SNAPSHOT`
   - setup: hydrated dataset present
   - action: run metadata snapshot export
   - expected: snapshot artifacts produced in git-ignored output path
4. `SEED-UI-FALLBACK`
   - setup: UI-importable throwaway dataset artifact prepared
   - action: import via Proton Pass UI, then run verification checks
   - expected: dataset shape matches planned seed baseline

### Lane 1: CLI Baseline

Purpose:

1. confirm provider/session behavior without MCP transport variables

Cases:

1. `CLI-UNAUTH-FS`
   - setup: `PROTON_PASS_KEY_PROVIDER=fs`, clean session dir
   - action: `scripts/pass-dev.sh info`
   - expected: authentication required error
2. `CLI-AUTH-FS`
   - setup: login via web/interactive using wrapper
   - action: `scripts/pass-dev.sh info` and `scripts/pass-dev-preflight.sh <expected-email>`
   - expected: info succeeds, preflight succeeds
3. `CLI-ENV-CI-PARITY`
   - setup: `PROTON_PASS_KEY_PROVIDER=env` + `PROTON_PASS_ENCRYPTION_KEY`
   - action: login + `scripts/pass-dev.sh info`
   - expected: successful auth path without filesystem/keyring dependency
4. `CLI-KEYRING-OPTIONAL`
   - setup: explicit opt-in to keyring mode
   - action: login + restart shell + info
   - expected: compatibility result recorded (pass/fail), not required for rollout

### Lane 2: MCP Inspector

Purpose:

1. validate auth behavior through Inspector transport/tooling

Cases:

1. `INSPECTOR-UNAUTH`
   - setup: unauthenticated session
   - action: call `view_session_info` (or `check_status`) via inspector
   - expected: auth failure surfaced with actionable guidance
2. `INSPECTOR-AUTH`
   - setup: authenticate throwaway account in same env/session dir
   - action: call `check_status`, `view_session_info`, `view_user_info`
   - expected: tool responses succeed
3. `INSPECTOR-POST-LOGOUT`
   - setup: authenticated then logout
   - action: repeat one authenticated tool call
   - expected: auth failure returns again

### Lane 3: Codex Agent MCP

Purpose:

1. validate behavior in real agent environment, not only inspector

Cases:

1. `CODEX-UNAUTH`
   - setup: project `.codex/config.toml` MCP server entry using `fs` provider and repo-local session dir
   - action: invoke a read-only MCP tool in Codex
   - expected: auth failure
2. `CODEX-AUTH`
   - setup: run `scripts/pass-dev.sh login` and `scripts/pass-dev-preflight.sh`
   - action: invoke `check_status`, `view_session_info`, `view_user_info` in Codex
   - expected: successful responses
3. `CODEX-WRONG-ACCOUNT-BLOCK`
   - setup: set `PASS_DEV_EXPECTED_EMAIL` to expected throwaway account
   - action: run preflight before test flow
   - expected: fails on mismatch and blocks flow

### Lane 4: CI Manual Workflow

Purpose:

1. validate unattended runner path with secrets and env provider

Workflow:

1. `.github/workflows/pass-cli-integration-manual.yml`

Cases:

1. `CI-AUTH-SMOKE`
   - action: dispatch workflow with required secrets
   - expected: login, preflight, info, build, test, logout complete
2. `CI-MISSING-SECRET-NEGATIVE`
   - action: dispatch with one required secret removed
   - expected: explicit failure at login/preflight stage

## Evidence to Capture

1. Command outputs for each case (success/failure lines only; avoid secrets).
2. Inspector response payload snippets for auth fail/success.
3. Codex-side tool outcome summary for unauth/authenticated states.
4. CI run URL and outcome summary.

## Pass Criteria

1. Behavior is consistent across CLI, Inspector, and Codex lanes.
2. Auth failures are clear and actionable before login.
3. Auth success is stable after login for the configured provider/session mode.
4. Throwaway-account guardrail blocks wrong-account usage.
5. CI manual workflow can run end-to-end with configured secrets.

## Stop/Fail Criteria

1. Any lane silently succeeds while unauthenticated.
2. Account mismatch is not caught by preflight.
3. CI requires unsupported/manual-only auth steps for configured account policy.
4. Any step depends on personal account or production vault data.

## Execution Notes

1. Keep this plan as design-time guidance until explicit test execution is approved.
2. Record outcomes in a follow-up test report doc when the plan is run.
