---
name: deployment-runbook-0.1
description: Archived deployment runbook snapshot for the initial v0.1.0 release flow.
---

# Deployment Runbook

## Scope

This runbook covers:

1. Pushing this project to a fresh GitHub remote
2. Releasing `v0.1.0` with Release Please

## Prerequisites

1. Clean local branch with intended release commits
2. Local checks passing (`npm run check`)
3. Empty GitHub repository created (no initialized files)

## One-Time Remote Setup

1. Set the new remote URL as `origin`.
2. Push your release branch to `main` on the new remote.
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
   - expected version is `0.1.0`
   - changelog content matches intended scope
   - package metadata changes are correct
5. Merge the Release Please PR.
6. Verify release outputs:
   - git tag `v0.1.0`
   - GitHub Release created
   - `CHANGELOG.md` and version bump committed to `main`

## Notes

1. `CHANGELOG.md` is managed by Release Please. Do not maintain it manually.
2. If Release Please proposes an unexpected version, do not merge; fix config first.

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
