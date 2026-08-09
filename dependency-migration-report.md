# Dependency Migration Report

Generated: 2026-08-09

Repository: `hesreallyhim/proton-pass-community-mcp`

Branch: `chore/deps`

Baseline commit: `82e046b6247fa7b02a56878bc0088e5066edc15c`

Migration commits: `e08f114` (npm dependencies and formatter delta), `0dba095` (pinned GitHub Actions)

## Outcome

All 11 open Dependabot PRs were inventoried and classified. This branch consolidates the compatible npm and GitHub Actions updates, rolls stale PR targets forward to current compatible releases, remediates every advisory reported by the baseline `npm audit`, applies the Prettier 3.9 formatting delta, and deliberately defers TypeScript 7 because the current lint toolchain does not support it.

The baseline dependency graph reported 10 npm vulnerabilities: 3 moderate and 7 high. The migrated graph reports 0 vulnerabilities.

No GitHub PR was merged, closed, commented on, relabeled, or otherwise mutated during this migration.

## Direct npm dependency changes

| Package                     | Baseline | Migrated | Reason                                                                                                      |
| --------------------------- | -------: | -------: | ----------------------------------------------------------------------------------------------------------- |
| `@modelcontextprotocol/sdk` |   1.29.0 |   1.30.0 | Current compatible runtime release; unlocks patched Hono transitive dependencies.                           |
| `@vitest/coverage-v8`       |    4.1.9 |   4.1.10 | Updated atomically with Vitest because the provider has an exact peer on the test runner.                   |
| `eslint`                    |   10.5.0 |   10.8.1 | Rolls Dependabot PR #146 forward from 10.7.0 to the current 10.x release.                                   |
| `fast-check`                |    4.8.0 |    4.9.0 | Current compatible fuzz-testing release.                                                                    |
| `globals`                   |   17.7.0 |   17.9.0 | Current compatible lint-environment definitions.                                                            |
| `prettier`                  |    3.8.4 |    3.9.6 | Rolls PR #147 forward from 3.9.5; includes the required formatting update to `test/server/test-support.ts`. |
| `tsx`                       |   4.22.4 |  4.23.11 | Rolls PR #144 forward from 4.23.0 to the latest compatible patch with follow-up loader/runtime fixes.       |
| `typescript-eslint`         |   8.62.0 |   8.66.0 | Rolls PR #149 forward from 8.63.0; retains the supported TypeScript `<6.1.0` range.                         |
| `vitest`                    |    4.1.9 |   4.1.10 | Updated atomically with `@vitest/coverage-v8`.                                                              |

TypeScript remains at 6.0.3. `@modelcontextprotocol/inspector` remains at 0.22.0 because its 2.1.0 major migration was discovered by the intake but is not represented by an open Dependabot PR and has a large independent transitive/smoke-test surface.

## Security-relevant transitive changes

| Package             |       Baseline |       Migrated | Relevant advisory or path                                                                                                          |
| ------------------- | -------------: | -------------: | ---------------------------------------------------------------------------------------------------------------------------------- |
| `fast-uri`          |          3.1.2 |          3.1.5 | Supersedes PR #150's still-vulnerable 3.1.4 target; fixes `GHSA-4c8g-83qw-93j6`, `GHSA-v2hh-gcrm-f6hx`, and `GHSA-7p8r-x3mc-p8w7`. |
| `@hono/node-server` |        1.19.14 |          2.1.0 | Fixes `GHSA-frvp-7c67-39w9` through SDK 1.30.0.                                                                                    |
| `hono`              |        4.12.27 |         4.13.1 | Clears current Hono advisories, including `GHSA-8j4g-w8fx-2239` and later 4.12.x fixes.                                            |
| `ip-address`        |         10.2.0 |         10.4.0 | Clears current SSRF/trust-boundary classification advisories.                                                                      |
| `shell-quote`       |          1.8.4 |          1.9.0 | Fixes `GHSA-395f-4hp3-45gv`.                                                                                                       |
| `concurrently`      |          9.2.3 |          9.2.4 | Removes the vulnerable `shell-quote` path.                                                                                         |
| `brace-expansion`   | 1.1.15 / 5.0.6 | 1.1.18 / 5.0.9 | Clears the installed major lines affected by the current denial-of-service advisories.                                             |
| `postcss`           |         8.5.15 |         8.5.26 | Clears current source-map path traversal/disclosure advisories.                                                                    |
| `nanoid`            |         3.3.15 |         3.3.18 | Clears current infinite-loop denial-of-service advisories.                                                                         |

## GitHub Actions changes

- `step-security/harden-runner` is updated in all nine active workflow files from 2.19.4 (`9af89fc71515a100421586dfdb3dc9c984fbf411`) to 2.20.0 (`bf7454d06d71f1098171f2acdf0cd4708d7b5920`). Existing `egress-policy: audit` inputs and job permissions are unchanged.
- `github/codeql-action/init`, `github/codeql-action/analyze`, and `github/codeql-action/upload-sarif` are updated atomically from 4.35.5 (`9e0d7b8d25671d64c341c19c0152d693099fb5ba`) to 4.36.3 (`54f647b7e1bb85c95cddabcd46b0c578ec92bc1a`). The atomic update avoids the configuration-version mismatch that makes PRs #139 and #141 fail independently.

All Actions remain pinned to full 40-character commit SHAs. Top-level workflow permissions remain unchanged and read-only/minimal.

## Open Dependabot PR dispositions

|                                                                         PR | Dependency                            | Observed state                                                                                                                              | Disposition on this branch                                              |
| -------------------------------------------------------------------------: | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [#150](https://github.com/hesreallyhim/proton-pass-community-mcp/pull/150) | `fast-uri` 3.1.2 → 3.1.4              | All checks pass, but 3.1.4 is vulnerable to a newer high-severity advisory.                                                                 | Superseded with secure compatible 3.1.5. Do not merge the PR as-is.     |
| [#149](https://github.com/hesreallyhim/proton-pass-community-mcp/pull/149) | `typescript-eslint` 8.62.0 → 8.63.0   | All checks pass.                                                                                                                            | Incorporated and rolled forward to 8.66.0.                              |
| [#148](https://github.com/hesreallyhim/proton-pass-community-mcp/pull/148) | TypeScript 6.0.3 → 7.0.2              | CI and Production Hygiene fail during `npm install` with `ERESOLVE`; current/latest `typescript-eslint` supports TypeScript only below 6.1. | Deferred. Keep TypeScript 6.0.3; do not merge or force-install this PR. |
| [#147](https://github.com/hesreallyhim/proton-pass-community-mcp/pull/147) | Prettier 3.8.4 → 3.9.5                | CI fails because `test/server/test-support.ts` needs the new formatter output.                                                              | Incorporated at 3.9.6 with the formatting delta applied.                |
| [#146](https://github.com/hesreallyhim/proton-pass-community-mcp/pull/146) | ESLint 10.5.0 → 10.7.0                | All checks pass.                                                                                                                            | Incorporated and rolled forward to 10.8.1.                              |
| [#145](https://github.com/hesreallyhim/proton-pass-community-mcp/pull/145) | Harden Runner 2.19.4 → 2.20.0         | All checks pass.                                                                                                                            | Incorporated across all nine active workflows at the PR's full SHA.     |
| [#144](https://github.com/hesreallyhim/proton-pass-community-mcp/pull/144) | `tsx` 4.22.4 → 4.23.0                 | All checks pass.                                                                                                                            | Incorporated and rolled forward to 4.23.11.                             |
| [#141](https://github.com/hesreallyhim/proton-pass-community-mcp/pull/141) | CodeQL `init` 4.35.5 → 4.36.3         | Both CodeQL analysis jobs fail because `analyze` remains on 4.35.5.                                                                         | Incorporated only as part of the atomic 4.36.3 CodeQL family update.    |
| [#140](https://github.com/hesreallyhim/proton-pass-community-mcp/pull/140) | CodeQL `upload-sarif` 4.35.5 → 4.36.3 | All checks pass.                                                                                                                            | Incorporated as part of the atomic 4.36.3 CodeQL family update.         |
| [#139](https://github.com/hesreallyhim/proton-pass-community-mcp/pull/139) | CodeQL `analyze` 4.35.5 → 4.36.3      | Both CodeQL analysis jobs fail because `init` remains on 4.35.5.                                                                            | Incorporated only as part of the atomic 4.36.3 CodeQL family update.    |
| [#123](https://github.com/hesreallyhim/proton-pass-community-mcp/pull/123) | CodeQL family 4.35.5 → 4.36.2         | Checks pass, but the PR is behind and its target is stale.                                                                                  | Superseded by the atomic 4.36.3 update.                                 |

## Validation evidence

The pre-migration baseline passed `npm ci`, `npm run check`, and `npm run build` at commit `82e046b`.

The migrated branch passed:

- `npm ci`: clean lockfile reproduction; 401 packages installed; 0 vulnerabilities.
- `npm audit --json`: 0 total vulnerabilities.
- `npm run check`: lint, Prettier check, typecheck, dedicated fuzz test, and full V8 coverage all passed.
- `npm run test:fuzz`: 2 tests passed.
- `npm run coverage`: 10 test files and 158 tests passed; statements 95.25%, branches 83.43%, functions 97.90%, lines 96.24%.
- `npm run analyze:complexity -- src --json-out .tmp/complexity-report.json`: 51 files and 191 functions analyzed, with 0 parser diagnostics.
- `npm run check:complexity-thresholds -- --report .tmp/complexity-report.json`: 0 LOC warnings, 0 LOC violations, average cyclomatic complexity 2.48 per function.
- `npm run check:production-hygiene`: 51 files scanned, 0 findings.
- `npm run check:release:package`: lint, typecheck, all 158 tests, TypeScript build, and `npm pack --dry-run` passed; the dry-run tarball contained 54 files.
- `git diff --check`: passed.

No live `pass-cli` or `pass` command was invoked. Validation remained within mocks, fixtures, static analysis, build, package, and unit/contract test surfaces as required by the release-preparation safety constraint.

## Rollback

The migration is isolated on `chore/deps`. Revert the dependency commits on this branch to restore the baseline manifests, lockfile, formatter output, and workflow SHAs. If only one surface needs rollback, the npm manifest/lockfile commit and the GitHub Actions commit are intentionally separable.

Do not restore `fast-uri` 3.1.4 as a partial rollback; it remains vulnerable. If the SDK update must be reverted, preserve or re-establish secure transitive resolutions and confirm `npm audit` remains at zero.

## Follow-up

- Close or supersede the incorporated/stale Dependabot PRs after this branch is merged, and explicitly close or defer TypeScript PR #148 with the peer-incompatibility rationale.
- Treat TypeScript 7 as a separate migration. Its native compiler does not expose the TypeScript programmatic API used by `typescript-eslint`; a deliberate side-by-side alias design is required until the lint toolchain supports it directly.
- Treat `@modelcontextprotocol/inspector` 2.1.0 as a separate major upgrade with Inspector-specific smoke validation.
- Consider declaring `@types/node` directly in a later maintenance change because `tsconfig.json` requests Node types while the package currently arrives transitively.
