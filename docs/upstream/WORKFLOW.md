# Upstream Docs Sync and Drift Workflow

## Purpose

This workflow keeps a local, pinned snapshot of Proton Pass CLI docs so schema/tool design can be reviewed offline and compared over time.

## Sync Commands

Primary command:

```bash
npm run docs:sync:pass-cli -- <ref>
```

Equivalent direct script call:

```bash
scripts/sync-pass-cli-docs.sh <ref>
```

Example:

```bash
npm run docs:sync:pass-cli -- 1.5.2
```

Output location:

1. `docs/upstream/pass-cli/<ref>/`
2. `SNAPSHOT_METADATA.json` records source URL, ref, and fetch timestamp.

## Source-of-Truth Assumptions

1. Runtime truth is the local installed CLI behavior.
2. `pass-cli --help` surface is authoritative for command shape and accepted flags.
3. Upstream docs snapshot is secondary reference for semantics, examples, and expected data models.
4. If CLI behavior and upstream docs disagree, prefer CLI behavior for implementation and record the mismatch.

## Taxonomy and Authority

### Identity Types

1. Branch tip (`main` HEAD): moving target, not reproducible.
2. Tag/ref (for example `1.5.2`): release label expected to map to a commit.
3. Commit SHA: immutable source state.
4. Installed binary identity (`pass-cli --version`, for example `1.5.2 (41cf394)`): actual runtime identity for MCP behavior.
5. Release notes/changelog: human summary of intended changes.
6. Published docs site / vendored docs snapshot: documentation state, may differ from runtime.

### Authority Order

For implementation and debugging decisions, use this order:

1. Installed CLI runtime behavior (highest authority).
2. CLI help contract (`--help`).
3. Pinned upstream source commit (tag resolved to SHA).
4. Vendored docs snapshot.
5. Changelog/release notes (lowest authority).

### Drift Taxonomy

1. Runtime drift: observed CLI/help behavior differs from expected behavior for a given version.
2. Docs drift: docs content differs from CLI behavior.
3. Release-note drift: release notes wording differs from observed behavior/docs details.

### Baseline Metadata (recommended)

Record these fields whenever updating drift baseline:

1. Capture timestamp (UTC).
2. Full `pass-cli --version` output.
3. Binary checksum and install channel (if available).
4. Upstream ref and resolved commit SHA.
5. Vendored docs snapshot ref and `SNAPSHOT_METADATA.json` timestamp.
6. Relevant changelog entry/version link.

## Source Location Status (Pass CLI)

As of 2026-03-01, public evidence suggests the `pass-cli` implementation source is not exposed in a clearly public repository.

Observed evidence:

1. `protonpass/pass-cli` exists and is versioned, but its root content is documentation/changelog-oriented (no obvious source tree):
   - <https://github.com/protonpass/pass-cli>
2. `pass-cli` tags (for example `1.5.2`) exist, but tag commits in this repo can be docs-only updates:
   - <https://github.com/protonpass/pass-cli/commit/89055e639bab238e6bf7e6a420246ea606893d14>
3. Official Homebrew formula distributes prebuilt binaries from `proton.me/download` instead of building from source:
   - <https://github.com/protonpass/homebrew-tap/blob/main/Formula/pass-cli.rb>
4. Official installation docs point to binary distribution + hashes (`versions.json`) rather than source build instructions:
   - <https://protonpass.github.io/pass-cli/get-started/installation/>
   - <https://proton.me/download/pass-cli/versions.json>
5. `protonpass/proton-pass-common` is public Rust workspace code, but does not clearly expose a CLI crate/package in workspace members:
   - <https://github.com/protonpass/proton-pass-common/blob/main/Cargo.toml>

Working assumption for this project:

1. Treat installed binary behavior as authoritative for MCP integration.
2. Treat docs/changelog repos as secondary references for intent and release notes.
3. Keep this status section updated if a public source repo is later identified.

## Drift Protocol

When drift is suspected:

1. Sync latest upstream docs to a new ref directory.
2. Compare snapshots:
   - `git diff -- docs/upstream/pass-cli/<old-ref> docs/upstream/pass-cli/<new-ref>`
3. Classify changes:
   - `shape`: flags/arguments/subcommands changed
   - `semantic`: meanings/constraints changed
   - `example-only`: docs wording/examples changed without contract impact
4. Validate against local CLI help for affected commands.
5. If contracts changed, update:
   - tool input schemas
   - output shaping logic
   - tests
   - `docs/TOOL_SCHEMA_PLAN.md`
6. Add a short decision note in PR/commit message when docs and CLI differ.

Notes:

1. Some non-help CLI commands require authenticated state and cannot be fully validated offline.
2. For safety-first probing, prefer `--help` contract checks and docs diffs; run non-help probes only in controlled test environments.

## Observed Drift Register

Use this table as the running baseline for known docs vs CLI mismatches.

| Date (UTC) | CLI Version | Area                                  | Upstream Docs Observation                                                                  | CLI Observation                                     | Class    | Status | Notes                                                        |
| ---------- | ----------- | ------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------- | -------- | ------ | ------------------------------------------------------------ |
| 2026-03-01 | 1.5.2       | `item list` options                   | `docs/commands/item.md` list synopsis omits `--filter-type`, `--filter-state`, `--sort-by` | CLI help for `item list` includes all three flags   | shape    | Open   | Tool schema should include these flags                       |
| 2026-03-01 | 1.5.2       | command coverage                      | `docs/commands/` has no `totp.md` or `support.md`                                          | CLI has top-level `totp` and `support` commands     | shape    | Open   | Missing command pages in docs snapshot                       |
| 2026-03-01 | 1.5.2       | `item create login` title requirement | `docs/commands/item.md` says `--title` is required unless using template                   | CLI help does not mark `--title` as required        | semantic | Open   | Treat title as expected but keep fallback behavior           |
| 2026-03-01 | 1.5.2       | `item view` semantics                 | `docs/commands/contents/view.md` wording differs from `docs/commands/item.md`              | CLI help aligns with `item view` command shape      | semantic | Open   | Prefer CLI help + `commands/item.md` over `contents/view.md` |
| 2026-03-01 | 1.5.2       | `item list --output json` shape       | No explicit JSON response schema documented                                                | Runtime observed shape is object with `items` array | semantic | Open   | Validate via authenticated test account when re-checking     |

## Safety and Repo Hygiene

1. Vendored upstream docs are intentionally excluded from Prettier normalization to preserve snapshot fidelity.
2. Avoid manual edits inside `docs/upstream/pass-cli/<ref>/` except replacing the full snapshot via sync.
