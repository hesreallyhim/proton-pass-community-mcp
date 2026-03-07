---
name: release-v1-checklist
description: Practical pre-release checklist for validating proton-pass-community-mcp in a real MCP host before shipping v1.
---

# Release V1 Checklist

Use this checklist when you are ready to run a release candidate through a real host application.

## 1. Baseline Readiness

- [ ] Working tree is clean (`git status`).
- [ ] `main` is up to date with intended release commits.
- [ ] `npm run check` passes locally.
- [ ] CI checks are green on latest commit.

## 2. Build and Launch

- [ ] `npm ci && npm run build` succeeds on a clean environment.
- [ ] MCP server starts via stdio without startup errors.
- [ ] Host application can connect to the server process.
- [ ] Tools list appears in host as expected.

## 3. Auth and Session Validation (Host)

- [ ] Authenticate via `pass-cli login` outside MCP.
- [ ] Confirm `check_status` returns healthy connectivity/auth state.
- [ ] Confirm auth error shape is clear when intentionally logged out (`AUTH_*` behavior).
- [ ] Confirm no workflow attempts credential capture inside MCP prompts/tools.

## 4. Core Workflow Smoke Tests (Host)

- [ ] Discovery flow works:
  - `list_vaults`
  - `list_items`
  - `search_items`
- [ ] Selection flow works:
  - `view_item` by URI and by selectors
  - `generate_item_totp` where applicable
- [ ] Utility flow works:
  - `view_session_info`
  - `view_user_info`
  - `view_settings`

## 5. Write-Safety and Mutative Controls

- [ ] With `ALLOW_WRITE` unset, mutative tools fail closed.
- [ ] With `ALLOW_WRITE=1` but no `confirm: true`, mutative tools fail closed.
- [ ] With both enabled, expected mutative actions succeed.
- [ ] Error messages for blocked writes are explicit and actionable.

## 6. Contract and Output Quality

- [ ] `list_items` and `search_items` remain reference-only (no secret-bearing content fields).
- [ ] Pagination behavior is consistent (`cursor`, `pageSize`, `nextCursor`).
- [ ] Tool outputs are predictable enough for LLM/tool-chaining.
- [ ] No host-breaking tool names/descriptions or schema regressions.

## 7. Compatibility and Drift Posture

- [ ] Upstream watch workflow status reviewed (`upstream-pass-cli-watch`).
- [ ] If upstream version changed, maintainer triage decision is documented.
- [ ] Manual template-drift check run if needed (`pass-cli-template-drift-weekly` via dispatch).

## 8. Documentation and Release Notes

- [ ] README reflects current tool surface and behavior.
- [ ] Any breaking changes are called out explicitly.
- [ ] ADR/doc changes merged for major policy decisions.
- [ ] Release notes include:
  - key capabilities
  - known limitations
  - expected user setup/auth model

## 9. Go/No-Go Decision

- [ ] At least one end-to-end host session completed successfully.
- [ ] No open P0/P1 issues for auth, data exposure, or tool correctness.
- [ ] Maintainer sign-off recorded (release issue/PR comment).

## 10. Post-Release Follow-Up

- [ ] Share in target communities and collect feedback/issues.
- [ ] Triage first-wave feedback into:
  - quick fixes
  - docs/usability improvements
  - deferred roadmap items
- [ ] Reassess v1.1 priorities based on actual usage patterns.
