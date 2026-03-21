---
name: deployment-runbook
description: Deployment and release runbook for this repository using PR-first flow, Release Please, and staged npm trusted publishing.
---

# Deployment Runbook

## Scope

This runbook covers ongoing release operations for this repository:

1. PR-first integration to `main`
2. Automated release PRs via Release Please
3. GitHub Release validation/package workflow
4. Staged npm trusted publishing enablement (approval-gated)

## Prerequisites

1. Clean local branch with intended release commits
2. Local checks passing (`npm run check`)
3. npm package name ownership for `proton-pass-community-mcp` (before first publish)

## Approval Gates

1. Gate 1: explicit maintainer confirmation is required before any `git push` (including tags/branches/workflow changes).
2. Gate 2: explicit maintainer confirmation is required before enabling `ENABLE_NPM_PUBLISH=true` or attempting any npm publish.

## One-Time Remote Setup

Use this only when bootstrapping a new remote:

1. Set the new remote URL as `origin`.
2. Push initial branch(es) and establish `main`.
3. Verify `main` is the default branch in GitHub.

## Required GitHub Settings

1. Enable GitHub Actions for the repository.
2. Set workflow permissions to allow write access.
3. Allow workflows to create pull requests when required by your org policy.
4. Create a protected GitHub environment named `npm-publish`.
5. Add workflow file `.github/workflows/publish-npm.yml` to `main`.

## One-Time npm Trusted Publisher Setup

Configure trusted publishing on npm for this package:

1. Open npm package settings for `proton-pass-community-mcp`.
2. Under Trusted publishing, choose GitHub Actions.
3. Configure:
   - GitHub owner/user: `hesreallyhim`
   - Repository: `proton-pass-community-mcp`
   - Workflow filename: `publish-npm.yml`
   - Environment name: `npm-publish`
4. Save settings.

Do not enable publish execution in workflow until maintainer approval is explicit.

## Release Process

1. Merge release-ready commits into `main` via PR (PR-first; no direct push to `main` in the default flow).
2. Wait for CI workflow (`.github/workflows/ci.yml`) on `main` to pass.
3. Wait for Release Please workflow (`.github/workflows/release-please.yml`) to open a release PR.
4. Review the Release Please PR:
   - expected semver bump for current scope
   - changelog content matches intended scope
   - package metadata changes are correct
5. Merge the Release Please PR.
6. Wait for publish workflow (`.github/workflows/publish-npm.yml`) on `release.published`.
7. Verify Stage A outputs (default, publish disabled):
   - expected git tag for the released version
   - GitHub Release created
   - `CHANGELOG.md` and version bump committed to `main`
   - npm package tarball asset (`.tgz`) uploaded to the GitHub Release
   - checksum file (`.sha256`) uploaded to the GitHub Release
   - workflow logs indicate `npm publish` was skipped by gate

## Stage B: Enable Publish Gate (Requires Explicit Maintainer Approval)

Enable only after explicit approval:

1. Set repo or environment variable `ENABLE_NPM_PUBLISH=true` for the `npm-publish` environment.
2. Confirm trusted publisher settings still match repository/workflow/environment.
3. Cut a new patch release (recommended) through normal Release Please flow.
4. Confirm publish workflow now runs `npm publish` and succeeds.

## Stage C: Post-First-Publish Hardening

After first successful trusted publish:

1. In npm package settings, set publishing access to `Require two-factor authentication and disallow tokens`.
2. Revoke obsolete npm automation tokens.
3. Keep publish execution gated behind maintainer release process controls.

## Notes

1. `CHANGELOG.md` is managed by Release Please. Do not maintain it manually.
2. If Release Please proposes an unexpected version, do not merge; fix config first.
3. Historical release-specific guidance for the initial release is archived at `docs/archived/DEPLOYMENT_0.1.md`.
4. To force a specific release version, add a commit body footer with `Release-As: X.Y.Z` (case insensitive) on a commit merged to `main`.
5. The publish workflow validates Node/npm minimums for trusted publishing (`Node >= 22.14.0`, `npm >= 11.5.1`).

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
4. Publish workflow ran but package not on npm:
   - confirm `ENABLE_NPM_PUBLISH=true`
   - confirm npm trusted publisher points at `publish-npm.yml`
   - confirm release was not marked prerelease
5. npm publish authentication failed:
   - verify workflow permissions include `id-token: write`
   - verify run is on GitHub-hosted runner and public repo
