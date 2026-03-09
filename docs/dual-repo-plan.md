# Dual-Repo Drift Plan

## Goal

Keep one identical codebase in two repositories:

- `owner/repo-public`: public merge surface, no secrets.
- `owner/repo-private`: private policy engine and secret boundary.

Operationally:

- Drift detection runs in `repo-private` on a schedule.
- If drift is detected, `repo-private` opens or updates a PR in `repo-public`.
- After merge in `repo-public`, a sync-back path updates `repo-private` so both repos converge.

This is eventual consistency with PR-driven enforcement, not direct autonomous mutation of both repos.

## Roles and Trust Model

- `repo-private` is the trust boundary (holds `APP_ID`, `APP_PRIVATE_KEY`, drift secrets).
- `repo-private` is the policy engine (detects/enforces drift contract).
- `repo-public` is the canonical merge/history surface.
- Preferred auth model: GitHub App installation token for all cross-repo writes.
- Rationale: avoids long-lived personal access tokens (PATs) and manual PAT rotation.
- Cross-repo writes must not rely on `GITHUB_TOKEN` from another repo.

## Repository and Remote Setup

1. Create two repos:

- `owner/repo-public`
- `owner/repo-private`

2. In one local clone, add both remotes and push the same branches to both.
3. Keep one shared workflow codebase in git; gate execution by `github.repository` so behavior diverges by target repo, not by file divergence.

## Workflow Gating

Use explicit repo checks in every sensitive job.

Examples:

- Public-safe jobs: `if: github.repository == 'owner/repo-public'`
- Secret drift jobs: `if: github.repository == 'owner/repo-private'`

## Trigger Model

- Drift/policy workflow in `repo-private`: scheduled (`cron`) trigger.
- Public-to-private sync workflow: push-based from `repo-public` default branch (or optional manual dispatch if needed).

Current intent: scheduled drift checks, not check-run gating.

## GitHub App Requirements

GitHub App is the default and recommended auth mechanism for this design.

1. Create one GitHub App and install on both repos.
2. Minimum permissions:

- Contents: read/write (on target repo for branch push)
- Pull requests: read/write (open/update PRs)

3. Store only in `repo-private`:

- `APP_ID`
- `APP_PRIVATE_KEY`
- Drift detection secrets

## Drift Enforcement Flow (Private -> Public)

1. `repo-private` scheduled job runs drift detection.
2. If no drift: exit cleanly.
3. If drift exists:

- Mint installation token.
- Target `repo-public`.
- Create/update branch (for example `drift-sync/<topic>`).
- Commit generated changes.
- Open or update PR in `repo-public`.

## Sync-Back Flow (Public -> Private)

After PR merge in `repo-public`, run sync-back in the opposite direction:

- Push or automation-driven mirror from `repo-public` to `repo-private`.
- Keep branch tips aligned to maintain eventual consistency.

## Loop and Safety Guards

- Add workflow/job concurrency on drift workflow to avoid competing PRs.
- Ignore bot branches (for example `drift-sync/*`) where appropriate.
- Ignore bot-authored commits/events where appropriate.
- Scope triggers (`branches`, `paths`, event types) to reduce self-trigger loops.
- Keep public CI limited to non-secret work.

## First Validation Pass

1. Push identical workflow/code branches to both repos.
2. Verify drift workflow runs only in `repo-private` on schedule.
3. Verify public-safe jobs run only in `repo-public`.
4. Force drift and confirm PR opens/updates in `repo-public`.
5. Merge PR in `repo-public` and confirm sync-back updates `repo-private`.
6. Negative test: verify public workflows cannot access private-only secrets.
