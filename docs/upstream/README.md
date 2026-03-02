---
name: upstream-docs-workflow
description: Canonical process for tracking pass-cli docs/runtime drift without committing upstream docs snapshots.
---

# Upstream Docs and Drift Workflow

This directory tracks upstream metadata and drift decisions for `pass-cli`.

Policy decision:

1. Upstream Proton Pass CLI docs are **not committed** to this repository.
2. Upstream docs may be fetched locally into `docs/upstream/pass-cli/` for analysis.
3. The local docs cache is ignored by git.

## Tracked Files

1. `docs/upstream/README.md` (this policy/workflow)
2. `docs/upstream/PASS_CLI_SOURCE_METADATA.json` (upstream refs and latest known version)

## Local Fetch Workflow (Ignored Cache)

Use the existing sync command when docs inspection is needed:

```bash
npm run docs:sync:pass-cli -- <ref>
```

Equivalent script:

```bash
scripts/sync-pass-cli-docs.sh <ref>
```

This writes into `docs/upstream/pass-cli/<ref>/` locally. Those files remain untracked.

## Source-of-Truth Assumptions

1. Runtime truth is installed CLI behavior.
2. `pass-cli --help` is authoritative for command shape and flag support.
3. Changelog/release notes provide intent and release deltas.
4. Fetched docs are a secondary transient reference during drift analysis.

## Authority Order

For implementation and debugging decisions:

1. Installed CLI runtime behavior.
2. CLI help output (`--help`).
3. Upstream changelog/release notes.
4. Transiently fetched docs cache.

## Drift Protocol

When drift is suspected:

1. Capture CLI evidence:
   - `pass-cli --version`
   - relevant `pass-cli <command> --help`
2. Review upstream changelog for matching release notes.
3. Optionally fetch docs to ignored cache for deeper comparison.
4. Classify drift:
   - `shape`: command/flag/argument differences
   - `semantic`: behavior/meaning differences
   - `docs-only`: wording/example differences
5. Update:
   - tool schemas/handlers
   - tests
   - `docs/TOOL_SCHEMA_PLAN.md`
   - drift register below

## Observed Drift Register

| Date (UTC) | CLI Version | Area                                  | Upstream Docs/Changelog Observation                                              | CLI Observation                                    | Class    | Status | Notes                                                  |
| ---------- | ----------- | ------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------- | -------- | ------ | ------------------------------------------------------ |
| 2026-03-01 | 1.5.2       | `item list` options                   | Upstream docs list synopsis omits `--filter-type`, `--filter-state`, `--sort-by` | CLI help for `item list` includes all three flags  | shape    | Open   | MCP now forwards these filters in `list_items`         |
| 2026-03-01 | 1.5.2       | command coverage                      | Upstream docs command pages missing `totp` and `support`                         | CLI has top-level `totp` and `support` commands    | shape    | Open   | Track for future parity phases                         |
| 2026-03-01 | 1.5.2       | `item create login` title requirement | Upstream docs say `--title` required unless template                             | CLI help does not mark `--title` as required       | semantic | Open   | Keep explicit validation expectations in MCP contracts |
| 2026-03-01 | 1.5.2       | `item view` semantics                 | Upstream docs wording differs across pages                                       | CLI help aligns with `item view` command shape     | semantic | Open   | Prefer CLI help wording                                |
| 2026-03-01 | 1.5.2       | `item list --output json` shape       | No explicit JSON response schema documented                                      | Runtime has `items` container in some environments | semantic | Open   | MCP now normalizes array/object item-list shapes       |
