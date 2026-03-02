---
name: upstream-docs-workflow
description: Canonical workflow for local docs sync and upstream version/SHA change watch.
---

# Upstream Sync and Watch Protocol

This project does not commit upstream Proton Pass docs snapshots.

## Policy

1. `docs/upstream/pass-cli/` is a local cache only and is git-ignored.
2. CI does not classify drift.
3. CI only reports whether tracked upstream references changed:
   - `upstream_repo_head_sha`
   - `latest_known_version`

## Tracked Metadata

File: `docs/upstream/PASS_CLI_SOURCE_METADATA.json`

Maintained fields used by CI watch:

1. `upstream_repo`
2. `upstream_repo_head_sha`
3. `latest_known_version`
4. `latest_known_version_source`
5. `latest_known_version_published_date`
6. `last_checked_utc`

## Local Sync (On Demand)

Fetch docs to local ignored cache only when needed:

```bash
npm run docs:sync:pass-cli -- <ref>
```

Equivalent command:

```bash
scripts/sync-pass-cli-docs.sh <ref>
```

Result location (untracked): `docs/upstream/pass-cli/<ref>/`

## CI Watch

Workflow: `.github/workflows/upstream-pass-cli-watch.yml`

Script: `scripts/check-pass-cli-upstream.mjs`

Local run:

```bash
npm run check:upstream:pass-cli
```

Behavior:

1. Reads tracked metadata file.
2. Fetches current upstream HEAD SHA from `upstream_repo`.
3. Fetches changelog from `latest_known_version_source` and parses latest version.
4. Fails when either tracked value changed.

This is an upstream-change alert only, not a drift verdict.

## Maintainer CTA When Watch Fails

1. Confirm the reported upstream changes.
2. Decide whether the change implies actionable drift for this project.
3. Update `docs/upstream/PASS_CLI_SOURCE_METADATA.json` with newly accepted baseline values.
4. If needed, run deeper contract checks (`pass-cli --help`, runtime probes, optional local docs sync).
5. Record any real drift decisions in project docs/tests.
