---
name: upstream-docs-workflow
description: Canonical workflow for local docs sync and upstream release watch.
---

# Upstream Sync and Watch Protocol

This project does not commit upstream Proton Pass docs snapshots.

## Policy

1. `docs/upstream/pass-cli/` is a local cache only and is git-ignored.
2. CI does not classify drift.
3. CI tracks the latest published `pass-cli` version via GitHub Tags API.

## Tracked Metadata

File: `docs/upstream/PASS_CLI_SOURCE_METADATA.json`

Maintained fields used by CI watch:

1. `upstream_repo`
2. `latest_known_version`
3. `latest_known_version_source`
4. `latest_known_version_changelog_source`
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
2. Fetches tags from `latest_known_version_source` (GitHub Tags API) and derives latest semver.
3. Uses `latest_known_version_changelog_source` only to read the matching published date.
4. Compares latest semver to `latest_known_version`.
5. When changed, syncs metadata and opens/updates an automated PR.

This is an upstream-release alert only, not a drift verdict.

## Maintainer CTA When Watch PR Opens

1. Confirm the reported release metadata.
2. Decide whether the change implies actionable drift for this project.
3. Run deeper contract checks as needed (`pass-cli --help`, runtime probes, optional local docs sync).
4. Record any real drift decisions in project docs/tests.
