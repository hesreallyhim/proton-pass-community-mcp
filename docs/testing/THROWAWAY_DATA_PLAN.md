---
name: throwaway-data-plan
description: Planning document for seeding, resetting, and snapshotting disposable Proton Pass test-account data.
---

# Throwaway Data Plan

## Objective

Establish a repeatable way to hydrate disposable Proton Pass test data for local development, Inspector checks, Codex-agent checks, and CI integration workflows.

## Current CLI Capability Assumptions

Based on current Proton Pass CLI docs and local empirical checks:

1. Documented item creation path is command-driven (`item create ...`), and template flow (`--get-template`, `--from-template`) is explicitly documented for login.
2. Empirically validated on March 6, 2026 (throwaway account): template flow also works for `note`, `credit-card`, `wifi`, `custom`, and `identity`.
3. SSH key import is supported for SSH key items (`item create ssh-key import`).
4. Generic account-level bulk import is not currently documented in the command reference.

Planning implication:

1. Seed/hydrate should be implemented as scripted creation loops (template-based where suitable), not assumed bulk-import APIs.
2. Proton Pass UI bulk import can be used as a contingency/bootstrap path if CLI scripting is too slow or incomplete for a given dataset shape.

## Data Seeding Strategy

### Incremental storage policy

Use a two-tier storage model so we can start lightweight and only formalize artifacts when destructive tooling matures.

Tier 1: ephemeral working artifacts (default, non-versioned)

1. Location: `<repo>/.tmp/throwaway-data/`
2. Contents:
   - generated import/export payloads
   - one-off hydration inputs
   - local run logs and snapshots
3. Version control:
   - do not commit
   - this location is intentionally disposable

Tier 2: promoted fixtures (versioned, selective)

1. Location: `test/fixtures/throwaway-seed/`
2. Contents:
   - only sanitized, synthetic, stability-critical fixtures
   - small deterministic datasets needed for repeatable tests
3. Version control:
   - commit only after explicit promotion decision
   - avoid large/bulky generated blobs unless required

Promotion criteria from Tier 1 -> Tier 2:

1. Artifact is needed to reproduce a test failure or invariant repeatedly.
2. Artifact format is stable enough to avoid frequent churn.
3. Artifact contains no real secrets and has clear ownership/maintenance intent.

### Canonical seed dataset (in-repo, fake data only)

1. Define a committed fixture dataset containing only synthetic secrets and metadata.
2. Organize by vault and item type.
3. Include stable IDs in fixture metadata to support idempotent re-runs.

Proposed structure:

1. `test/fixtures/throwaway-seed/manifest.json`
2. `test/fixtures/throwaway-seed/vaults/*.json`
3. `test/fixtures/throwaway-seed/items/*.json`

### Hydration workflow (planned scripts)

1. `seed:preflight`
   - run account preflight and assert throwaway account
2. `seed:vaults`
   - create required vaults if missing
3. `seed:items`
   - create/update fixture items via CLI commands (template-based where available)
4. `seed:verify`
   - assert expected vault/item counts and required sentinel titles

### Fallback hydration path (UI import)

1. Maintain an importable throwaway dataset artifact format compatible with Proton Pass UI import.
2. Use UI import for rapid account bootstrap when:
   - CLI-seeded coverage for some item type is incomplete
   - a large dataset must be loaded quickly for manual exploratory testing
3. After UI import, run `seed:verify` or equivalent checks to validate expected structure.
4. Treat UI import as a fallback/accelerator, not a replacement for scriptable CI-friendly hydration.

UI fallback artifact handling:

1. Keep experimental UI-import files in Tier 1 (`.tmp/throwaway-data/`) while format is evolving.
2. Promote only a minimal, proven sample import artifact to Tier 2 when it becomes useful for repeatable team onboarding/testing.

### Reset workflow (planned scripts)

1. `seed:reset`
   - remove only seed-managed assets (for example title/tag prefix convention)
2. `seed:rehydrate`
   - `seed:reset` then full hydration

## Snapshot / Backup Strategy

Purpose:

1. Preserve reproducible state for debugging and drift checks.

Approach:

1. Snapshot read-only metadata using `item list --output json` and targeted `item view` calls.
2. Store snapshots under a git-ignored path (for example `docs/upstream/pass-cli/<date-or-ref>/throwaway-snapshots/` or `.tmp/`).
3. Keep snapshots outside committed fixtures unless explicitly sanitized and intended for test fixtures.

Retention guideline:

1. Local Tier 1 snapshots are short-lived and can be overwritten frequently.
2. Only promote snapshots that provide long-term debugging value.

## Safety Constraints

1. Use throwaway account only.
2. Never seed real credentials.
3. Require preflight account-identifier checks before any reset/hydrate action.
4. Keep destructive reset commands opt-in and explicitly named.

## CI Considerations

1. CI should support a lightweight seed set by default (small deterministic dataset).
2. Full seed set can be manual/on-demand to control runtime.
3. CI uses `env` key provider mode and throwaway credentials from secrets.

## Open Design Questions

1. Whether seed scripts should be shell, Node.js, or mixed.
2. Whether to support upsert semantics for non-login item types in the first iteration.
3. Whether snapshot outputs should be normalized into stable fixture schema for contract tests.
4. Which canonical import artifact should be maintained for UI fallback (for example CSV/JSON flavor, field mapping, vault routing).

## Proposed Milestones

1. Milestone 1: minimal seed pack (1-2 vaults, ~20 synthetic login items) + verification.
2. Milestone 2: reset + rehydrate workflow with safety guardrails.
3. Milestone 3: snapshot export and fixture normalization for regression checks.
