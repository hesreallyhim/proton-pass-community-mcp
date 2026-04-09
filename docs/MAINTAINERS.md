# Maintainers

Administrative and release-operational guidance for project maintainers.

## Scope

This document covers maintainer-only operational concerns. Contributor-facing coding guidance belongs in `CONTRIBUTING.md`.

## CI Workflow: Upstream Watch

Workflow file: `.github/workflows/upstream-pass-cli-watch.yml`

Purpose:

1. Detect whether tracked upstream references changed.
2. Alert maintainers when baseline references are stale.

What it checks:

1. `latest_known_version`
2. `latest_known_version_published_date`
3. `last_checked_utc`

Source of truth for tracked values:

1. `docs/upstream/PASS_CLI_SOURCE_METADATA.json`

Important constraint:

1. This workflow is **not** a drift detector.
2. It does not determine contract/behavior compatibility changes.
3. It only reports that upstream references moved.

Template drift workflow policy:

1. `.github/workflows/pass-cli-template-drift-weekly.yml` is manual-dispatch only.
2. Use it when upstream watch (or other signals) indicate follow-up CLI contract verification is warranted.

## Maintainer CTA When Upstream Watch Fails

1. Review workflow output and confirm the new version metadata.
2. Decide whether the update implies actionable drift for this project.
3. If accepted, update `docs/upstream/PASS_CLI_SOURCE_METADATA.json`:
   - `latest_known_version`
   - `latest_known_version_published_date`
   - `last_checked_utc`
4. If needed, run local triage:
   - `pass-cli --version`
   - relevant `pass-cli <command> --help`
   - optional local docs cache fetch (`npm run docs:sync:pass-cli -- <ref>`)
   - note: current upstream tags use unprefixed semver values such as `1.10.0`
5. Record resulting decisions in docs/tests and merge.

## Documentation Convention: Front Matter

Maintain a YAML front matter block on all maintained documentation pages.

Required minimum keys:

1. `name`
2. `description`

Recommended pattern:

```yaml
---
name: short-kebab-name
description: One-sentence summary of canonical purpose.
---
```

Notes:

1. Use stable `name` values for cross-reference consistency.
2. Keep `description` concrete and operational (not marketing text).

## Throwaway CLI Auth Quick Commands

Use the repo wrapper for all project-side CLI calls. Canonical npm entrypoint:

```bash
npm run pass -- <pass-cli-args...>
```

Equivalent shell wrapper:

```bash
scripts/pass-dev.sh <pass-cli-args...>
```

Do not use bare `pass-cli` for normal project work if you want the repo-local session/key-provider guardrails.

Local throwaway login + guardrail preflight:

```bash
scripts/pass-dev.sh login --interactive <throwaway-account-identifier>
export PASS_DEV_EXPECTED_ACCOUNT=<throwaway-account-identifier>
scripts/pass-dev-preflight.sh
```

The wrapper keeps auth in the repo-local session dir and avoids default keychain/keyring access, but the preflight is what actually verifies the active account matches the throwaway target.

Quick verification:

```bash
scripts/pass-dev.sh info
scripts/pass-dev.sh user info --output json
```

CI-style auth pattern (`env` key provider):

```bash
export PROTON_PASS_KEY_PROVIDER=env
export PROTON_PASS_ENCRYPTION_KEY=<ci-secret-value>
scripts/pass-dev.sh login --interactive <throwaway-account-identifier>
scripts/pass-dev-preflight.sh <throwaway-account-identifier>
```

Cleanup:

```bash
scripts/pass-dev.sh logout
```
