# Dependency review — 2026-08-27

Reviewed all 10 open Dependabot PRs against baseline commit `5fc186b9d7292ccd346efe95fcc1dc1a31281b30`. The initial dependency commits are retained on `codex/rehabilitation-2026-08-27`, which also includes the subsequent packaging and CLI rehabilitation; no PR was merged, closed, or otherwise modified on GitHub. Registry metadata, upstream releases, PR diffs, and failing CI job logs were checked on this date. The runtime remains Node 24, and validation uses fixtures rather than a live Proton Pass vault.

## npm decisions

| Dependency                         | Previous                        | Selected                     | Reason                                                                                                                          |
| ---------------------------------- | ------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `@modelcontextprotocol/inspector`  | 0.22.0                          | 2.4.0                        | Inspector v2 migration completed with explicit child environment, updated CLI ordering, and current 47-tool fixture smoke.      |
| `@types/node`                      | Undeclared; transitively 26.2.0 | 24.13.3, explicitly declared | Match the supported Node 24 runtime and stop relying on Inspector to supply the project's Node type definitions.                |
| `@vitest/coverage-v8` and `vitest` | 4.1.10                          | 4.1.11                       | Update together to satisfy their exact peer requirements; includes lifecycle concurrency and mock filesystem restriction fixes. |
| `eslint`                           | 10.8.1                          | 10.9.1                       | Includes safer autofixes and the follow-up fix for a numeric-precision false positive.                                          |
| `globals`                          | 17.9.0                          | 17.11.0                      | Compatible additions to global identifier tables; the existing Node globals configuration is preserved.                         |
| `tsx`                              | 4.23.11                         | 4.23.12                      | Fixes `import.meta` handling when tokens are separated by comments or newlines.                                                 |
| `typescript-eslint`                | 8.66.0                          | 8.68.0                       | Includes rule fixes and ESLint metadata support; retains support for TypeScript 6.0.3 and ESLint 10.                            |

Sources: [Inspector 1.0.0](https://github.com/modelcontextprotocol/inspector/releases/tag/1.0.0), [Inspector 1.0.2](https://github.com/modelcontextprotocol/inspector/releases/tag/1.0.2), [Node 24 types](https://www.npmjs.com/package/@types/node/v/24.13.3), [Vitest 4.1.11](https://github.com/vitest-dev/vitest/releases/tag/v4.1.11), [ESLint 10.9.0](https://github.com/eslint/eslint/releases/tag/v10.9.0), [ESLint 10.9.1](https://github.com/eslint/eslint/releases/tag/v10.9.1), [globals 17.10.0](https://github.com/sindresorhus/globals/releases/tag/v17.10.0), [globals 17.11.0](https://github.com/sindresorhus/globals/releases/tag/v17.11.0), [tsx 4.23.12](https://github.com/privatenumber/tsx/releases/tag/v4.23.12), [typescript-eslint 8.67.0](https://github.com/typescript-eslint/typescript-eslint/releases/tag/v8.67.0), and [typescript-eslint 8.68.0](https://github.com/typescript-eslint/typescript-eslint/releases/tag/v8.68.0).

`npm update --ignore-scripts --package-lock-only` also refreshed transitive dependencies within their parents' declared constraints. No forced resolution or peer-dependency bypass was used. Runtime transitives include `@hono/node-server` 2.1.1, Hono 4.13.5, JOSE 6.2.10, and `eventsource-parser` 3.1.1. Existing native platform entries are retained; the Rolldown update adds an Android ARM entry. The only dependency installation scripts remain the previously allowed `esbuild@0.28.2` and `fsevents@2.3.3` scripts.

Hono 4.13.5 includes query-parsing, static-generation path-containment, and body-parsing security fixes; JOSE 6.2.10 tightens token/key validation. These are worthwhile transitive updates even though the baseline npm audit reported no advisories. [Hono release](https://github.com/honojs/hono/releases/tag/v4.13.5), [JOSE release](https://github.com/panva/jose/releases/tag/v6.2.10)

The runtime dependencies `@modelcontextprotocol/sdk` 1.30.0 and Zod 4.4.3 were already the latest stable versions. `@eslint/js` 10.0.1, `fast-check` 4.9.0, Husky 9.1.7, and Prettier 3.9.6 also remain current. Prerelease tags were excluded.

## Deferred or unnecessary npm changes

### TypeScript 7.0.2

Retain TypeScript 6.0.3. The latest `typescript-eslint` 8.68.0 declares a TypeScript peer range of `>=4.8.4 <6.1.0`; TypeScript 7 is outside it. PR #148 already fails `npm ci` with `ERESOLVE` for this reason. The complexity report also imports the TypeScript compiler API, so a later migration must validate that integration as well as compilation. Do not use `--force` or `--legacy-peer-deps` to suppress the conflict. Revisit when the lint toolchain supports TypeScript 7. [Published peer requirements](https://registry.npmjs.org/typescript-eslint/8.68.0)

### Inspector 2.4.0: initial deferral resolved

The initial review selected classic Inspector 1.0.2 as an intermediate security-maintenance release. Rehabilitation now migrates to 2.4.0, superseding PR #155's 2.2.0 target. `@types/node` remains an explicit development dependency rather than an accidental transitive dependency.

The CLI smoke now uses target-before-separator ordering, explicit child `-e` environment forwarding, isolated storage/catalog paths, the memory secret store, and v2 exit-5 JSON error envelopes. The interactive npm command uses `mcp-inspector --web node dist/index.js`. Shell-only `PASS_CLI_BIN` is insufficient in v2: explicitly forward the binary and other server environment settings. [Migration guide](https://github.com/modelcontextprotocol/inspector/blob/2.4.0/docs/v1-to-v2-migration.md), [v2 transport](https://github.com/modelcontextprotocol/inspector/blob/2.4.0/core/mcp/node/transport.ts#L77)

The migration was installed without peer overrides. It adds optional native keyring packages and the deprecated `@modelcontextprotocol/server-legacy` transport dependency; tests use the memory store and do not establish native keyring conformance on every platform. A fixture-backed interactive launch returned HTTP 200 from the loopback UI and API, showed one read-only server, and made zero CLI calls. That checks launch and configuration, not browser interactions or live Proton Pass access.

Clean `npm ci` warns that Inspector's postinstall is not in `allowScripts`. Static inspection of its published `scripts/install-clients.mjs` shows that it exits without installing anything when loaded under `node_modules`; the built clients are already shipped. It remains unapproved, and smoke checks run with it blocked. Existing esbuild/fsevents script allowances are unchanged.

### cloc and Node type major versions

Retain `cloc` 2.11.0. Its npm `latest` tag points to `2.6.0-cloc`, which is older and outside the existing `^2.11.0` range. Following that tag would be an unjustified downgrade. Node types are intentionally constrained to major 24 instead of the registry's newer major 26, to reflect the supported runtime. [cloc registry metadata](https://registry.npmjs.org/cloc)

## GitHub Actions

Every selected release tag was resolved to its full commit SHA with `git ls-remote`, including annotated-tag dereferencing. Updates preserve workflow inputs, triggers, and permissions. The three private workflow templates remain inactive under `.github/private-repo-workflows/`; their floating checkout/setup-node references are now pinned as well.

| Action                                                     | Previous active version | Selected version                                                              | Verified commit                            |
| ---------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------- | ------------------------------------------ |
| `actions/checkout`                                         | 7.0.0                   | [7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1)              | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| `actions/setup-node`                                       | 6.4.0                   | [7.0.0](https://github.com/actions/setup-node/releases/tag/v7.0.0)            | `820762786026740c76f36085b0efc47a31fe5020` |
| `step-security/harden-runner`                              | 2.20.0                  | [2.21.0](https://github.com/step-security/harden-runner/releases/tag/v2.21.0) | `05e31511f85b41b11d1cf0ef85d0992719546e2c` |
| `github/codeql-action` (`init`, `analyze`, `upload-sarif`) | 4.36.3                  | [4.37.9](https://github.com/github/codeql-action/releases/tag/v4.37.9)        | `cdf488f595d80d6e07e03d4674febd5ab45fa938` |
| `ossf/scorecard-action`                                    | 2.4.3                   | [2.4.4](https://github.com/ossf/scorecard-action/releases/tag/v2.4.4)         | `2d1146689b8cda280b9bc96326124645441f03bc` |

`setup-node` 7 keeps the Node 24 action runtime and the inputs used here. Its removal of the dummy `NODE_AUTH_TOKEN` export is compatible with this repository's OIDC npm publishing configuration. Harden Runner remains in audit mode. Scorecard now bundles analyzer 5.5.0, which can change reported scores and logs publication failures instead of failing the entire action.

All CodeQL steps move together: PRs #139 and #141 show actual failures when `init` and `analyze` versions differ. CodeQL's generic latest-release endpoint can return a `codeql-bundle-*` tag; the selected SHA is verified against the action's `v4.37.9` tag, not a bundle tag.

The other eight action repositories were checked and remain at their latest releases: semantic-pull-request 6.1.1, dependency-review-action 5.0.0, create-github-app-token 3.2.0, release-please-action 5.0.0, cosign-installer 4.1.2, Codacy coverage reporter 1.3.0, upload-artifact 7.0.1, and `peter-evans/create-pull-request` 8.1.1. The app-token comment now records the exact 3.2.0 version; its SHA is unchanged.

## Every open Dependabot PR

| PR                                                                         | Proposal                     | Disposition                                                                                         |
| -------------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------- |
| [#156](https://github.com/hesreallyhim/proton-pass-community-mcp/pull/156) | tsx 4.23.12                  | Included. Its checks and tests pass; its CI failure is the Codacy upload, not a tsx regression.     |
| [#155](https://github.com/hesreallyhim/proton-pass-community-mcp/pull/155) | Inspector 2.2.0              | Superseded by 2.4.0 after CLI/web migration and fixture verification; Node types declared directly. |
| [#154](https://github.com/hesreallyhim/proton-pass-community-mcp/pull/154) | globals 17.11.0              | Included. Its checks and tests pass before the same Codacy upload failure.                          |
| [#153](https://github.com/hesreallyhim/proton-pass-community-mcp/pull/153) | typescript-eslint 8.67.0     | Superseded by compatible 8.68.0. Its checks and tests pass before the same Codacy upload failure.   |
| [#148](https://github.com/hesreallyhim/proton-pass-community-mcp/pull/148) | TypeScript 7.0.2             | Defer: incompatible lint peer range; CI installation fails with `ERESOLVE`.                         |
| [#145](https://github.com/hesreallyhim/proton-pass-community-mcp/pull/145) | Harden Runner 2.20.0         | Already present at the baseline; superseded here by 2.21.0.                                         |
| [#141](https://github.com/hesreallyhim/proton-pass-community-mcp/pull/141) | CodeQL `init` 4.36.3         | Already present; superseded by synchronized 4.37.9. Do not merge the isolated step bump.            |
| [#140](https://github.com/hesreallyhim/proton-pass-community-mcp/pull/140) | CodeQL `upload-sarif` 4.36.3 | Already present; superseded by synchronized 4.37.9.                                                 |
| [#139](https://github.com/hesreallyhim/proton-pass-community-mcp/pull/139) | CodeQL `analyze` 4.36.3      | Already present; superseded by synchronized 4.37.9. Do not merge the isolated step bump.            |
| [#123](https://github.com/hesreallyhim/proton-pass-community-mcp/pull/123) | CodeQL 4.36.2                | Unnecessary: older than the baseline 4.36.3 and selected 4.37.9.                                    |

The five stale action PRs can be closed as superseded once the consolidated updates are accepted. PRs #153, #154, #155, and #156 can likewise be closed after these changes land. No remote cleanup was performed as part of this local update.

## Rehabilitation of the existing server

- Issue [#130](https://github.com/hesreallyhim/proton-pass-community-mcp/issues/130) and the fix proposed in [#131](https://github.com/hesreallyhim/proton-pass-community-mcp/pull/131): the runtime template snapshot is now included in `package.json.files`. A production-only, cold-cache consumer install of the actual tarball must initialize MCP, list all 47 tools, read all 7 resources, perform fixture reads, and reject writes without a CLI call. The release-package check and CI include this regression check.
- CLI watch PR [#138](https://github.com/hesreallyhim/proton-pass-community-mcp/pull/138): metadata, advisory baseline, and the six existing template resources now target 2.3.3 at commit `51a4c9b110a0ffe6e81f4f5d3877b9e5a0c24112`. The snapshot refresh is source-derived, not a new live capture. See the [47-tool compatibility matrix](docs/testing/PASS_CLI_2.3.3_COMPATIBILITY.md).
- Existing tools now handle real subprocess stdin/EOF, per-call audit reasons, removed/changed flags, current metadata output, raw secret field text, and safe argument boundaries. No new tools were added. Four mutation tools require `agentReason`, and attachment downloads now require the existing write gates; these input changes need a breaking-change release note.
- CI also executes the current Inspector smoke. It no longer relies on obsolete eight-tool assertions.

## Validation and remaining operational notes

- `npm ci` succeeds on Node 24.18.0/npm 11.16.0, without peer bypasses or newly approved installation scripts.
- `npm run check` passes lint, formatting, typecheck, three fuzz tests, and all 247 tests across 11 files. Recorded acceptance-run coverage is 95.95% statements, 86.40% branches, 97.65% functions, and 96.61% lines. Repeated runs varied slightly in branch coverage (86.21–86.40%) because fuzz cases are randomized.
- `npm run check:release:package` passes, including the actual cold-cache production tarball install and MCP stdio checks: 47 tools, 7 resources, exact field text, per-call reason isolation, and invalid/disabled writes with zero CLI calls.
- `npm run mcp:inspect:smoke` passes on Inspector 2.4.0 with explicit environment isolation and v2 error envelopes.
- `npm audit --json` reports zero known advisories; `npm ls --all` reports a valid tree. Manifest/lockfile ranges, every locked Node engine range, Vitest/coverage pairing, and all 12 optional keyring platform entries were checked.
- `npm outdated --all --json` has no unaddressed installed-package updates: its three installed peer suggestions are Node 26 types (Vite/Vitest) and TypeScript 7 (ts-api-utils), retained at the project's compatible selections. Missing optional/platform packages are not stale installed dependencies. No transitive-major overrides were added.
- `actionlint`, all 38 full-SHA action references, read-only workflow-level permissions, output-policy generation, enforced complexity thresholds, production hygiene, and `git diff --check` pass.
- The actual SDK protocol test checks that all 44 input tool schemas publish their fields; `list_invites` pagination is now advertised. Empty invitation requests use `arguments: {}` instead of omitting the object.

Complexity review reduced modified argument-builder/runner functions and preserved validation ordering. The final average is 2.38; the runner has 264 physical lines and retains a 250-line advisory warning, below the 500-line gate. The comparator used 2,916 selector cases; real Node child tests cover stdin, EOF, failures, and concurrent reason isolation. These are regression checks, not live upstream conformance.

The Codacy failures in PRs #153, #154, and #156 occur after tests and LCOV generation pass. The logs show a nonempty masked API token and a failed upload reporting an invalid request URL/token combination; this is not evidence that Dependabot lacked the secret. A repository owner must verify the token type, repository access, and endpoint in Codacy. No secret, permission, or upload-failure policy was changed, and no authenticated upload was attempted. This external CI failure remains unresolved. [Example failed job](https://github.com/hesreallyhim/proton-pass-community-mcp/actions/runs/31981177888/job/95248106287)

The upstream setup-node documentation recommends disabling dependency caches in privileged publishing jobs. This repository's publish job already uses `cache: npm`; that pre-existing hardening concern remains noted instead of changing publishing policy during rehabilitation. [Upstream publishing guidance](https://github.com/actions/setup-node/blob/v7.0.0/docs/advanced-usage.md)

No live CLI command, authenticated workflow, package publication, remote CI run, or PR cleanup was triggered. Local source/fixture compatibility is not a guarantee about live accounts, capability grants, or atomic mutation/audit delivery.

## Rollback

Runtime alignment is in `f7221c5`; packaging, Inspector, and CI smoke integration are in `4aafacb`. The earlier compatible dependency and Actions updates are `7e0737b` and `93e80e7`.

Revert the rehabilitation commits in reverse order, then run `npm ci` on Node 24. The packaging regression fix can be retained independently; reverting it reintroduces issue #130. Revert the earlier dependency and Actions commits separately if those updates must also be undone. No credentials or vault data were migrated. Older server contracts omit the new audit-reason safeguards and are not a safe fallback for agent mutations on CLI 2.3.3.
