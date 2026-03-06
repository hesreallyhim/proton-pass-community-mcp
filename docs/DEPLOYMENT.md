---
name: deployment-runbook
description: Generic deployment and release runbook for this repository using PR-first flow and Release Please.
---

# Deployment Runbook

## Scope

This runbook covers ongoing release operations for this repository:

1. PR-first integration to `main`
2. Automated release PRs via Release Please
3. Tag/release verification after merge

## Prerequisites

1. Clean local branch with intended release commits
2. Local checks passing (`npm run check`)

## One-Time Remote Setup

Use this only when bootstrapping a new remote:

1. Set the new remote URL as `origin`.
2. Push initial branch(es) and establish `main`.
3. Verify `main` is the default branch in GitHub.

## Required GitHub Settings

1. Enable GitHub Actions for the repository.
2. Set workflow permissions to allow write access.
3. Allow workflows to create pull requests when required by your org policy.

## Release Process

1. Merge release-ready commits into `main` via PR (PR-first; no direct push to `main` in the default flow).
2. Wait for CI workflow (`.github/workflows/ci.yml`) on `main` to pass.
3. Wait for Release Please workflow (`.github/workflows/release-please.yml`) to open a release PR.
4. Review the Release Please PR:
   - expected semver bump for current scope
   - changelog content matches intended scope
   - package metadata changes are correct
5. Merge the Release Please PR.
6. Verify release outputs:
   - expected git tag for the released version
   - GitHub Release created
   - `CHANGELOG.md` and version bump committed to `main`

## Notes

1. `CHANGELOG.md` is managed by Release Please. Do not maintain it manually.
2. If Release Please proposes an unexpected version, do not merge; fix config first.
3. Historical release-specific guidance for the initial release is archived at `docs/archived/DEPLOYMENT_0.1.md`.
4. To force a specific release version, add a commit body footer with `Release-As: X.Y.Z` (case insensitive) on a commit merged to `main`.

Example:

```text
chore: release 0.2.0

Release-As: 0.2.0
```

## Troubleshooting

1. No release PR appears:
   - confirm `release-please.yml` exists on `main`
   - confirm Actions permissions allow write
2. Release PR version is wrong:
   - inspect commit history and release-please config
   - correct configuration, then rerun workflow
3. CI failing on PR or `main`:
   - fix failures on branch/PR
   - re-run checks before merging
