# Upstream Docs Snapshots

This directory contains pinned snapshots of upstream documentation used as a local reference for schema design and drift checks.

## Proton Pass CLI

Snapshots live under:

1. `docs/upstream/pass-cli/<ref>/`

Each snapshot includes:

1. `docs/` (copied from upstream `docs/public/docs`)
2. `README.md` (copied from upstream `docs/public/README.md`)
3. `zensical.toml` (copied from upstream `docs/public/zensical.toml`)
4. `SNAPSHOT_METADATA.json` (local provenance metadata)

Sync command:

```bash
scripts/sync-pass-cli-docs.sh <ref>
```

Example:

```bash
scripts/sync-pass-cli-docs.sh 1.5.2
```

Reference website:

1. <https://protonpass.github.io/pass-cli/>

Workflow and drift handling:

1. See `docs/upstream/WORKFLOW.md`.
