# Dependency review — 2026-08-27

Reviewed all 10 open Dependabot PRs against baseline commit `5fc186b9d7292ccd346efe95fcc1dc1a31281b30`. Changes are consolidated on `codex/deps-2026-08-27`; no PR was merged, closed, or otherwise modified on GitHub. Registry metadata, upstream releases, PR diffs, and failing CI job logs were checked on this date. The runtime remains Node 24, and validation uses fixtures rather than a live Proton Pass vault.

## npm decisions

| Dependency                         | Previous                        | Selected                     | Reason                                                                                                                          |
| ---------------------------------- | ------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `@modelcontextprotocol/inspector`  | 0.22.0                          | 1.0.2                        | Compatible classic Inspector maintenance release with a DNS rebinding protection fix; defer v2 migration below.                 |
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

### Inspector 2.4.0 (PR #155 targets 2.2.0)

Keep the classic implementation on its latest security-maintenance release, 1.0.2. This line is deprecated and receives security fixes only; the selection is an intermediate step, not a claim that v2 is unnecessary.

Static comparison of the published 0.22.0 and 1.0.2 packages found the existing CLI implementation unchanged except for a deprecation notice written to stderr. Inspector 2 changes the CLI separator ordering used by `scripts/inspector-smoke.mjs`, child-process environment propagation, and error exit semantics. In particular, setting `PASS_CLI_BIN` only on the Inspector process no longer guarantees that the child MCP server uses the fixture: v2 needs an explicit `-e PASS_CLI_BIN=...` argument or equivalent configuration. A future migration must update and test both the interactive launch and CLI smoke paths before any invocation against a real vault. [Migration guide](https://github.com/modelcontextprotocol/inspector/blob/2.4.0/docs/v1-to-v2-migration.md), [CLI parsing](https://github.com/modelcontextprotocol/inspector/blob/2.4.0/clients/cli/src/cli.ts#L595), [v1 environment handling](https://github.com/modelcontextprotocol/inspector/blob/1.0.2/cli/src/transport.ts#L25), [v2 transport](https://github.com/modelcontextprotocol/inspector/blob/2.4.0/core/mcp/node/transport.ts#L77)

PR #155 also fails typechecking because Node type definitions disappear from its dependency tree. Declaring `@types/node` directly fixes that dependency omission here, but does not resolve the v2 invocation and environment changes.

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

| PR                                                                         | Proposal                     | Disposition                                                                                          |
| -------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| [#156](https://github.com/hesreallyhim/proton-pass-community-mcp/pull/156) | tsx 4.23.12                  | Included. Its checks and tests pass; its CI failure is the Codacy upload, not a tsx regression.      |
| [#155](https://github.com/hesreallyhim/proton-pass-community-mcp/pull/155) | Inspector 2.2.0              | Defer the v2 migration. Apply compatible security-maintenance 1.0.2 and declare Node types directly. |
| [#154](https://github.com/hesreallyhim/proton-pass-community-mcp/pull/154) | globals 17.11.0              | Included. Its checks and tests pass before the same Codacy upload failure.                           |
| [#153](https://github.com/hesreallyhim/proton-pass-community-mcp/pull/153) | typescript-eslint 8.67.0     | Superseded by compatible 8.68.0. Its checks and tests pass before the same Codacy upload failure.    |
| [#148](https://github.com/hesreallyhim/proton-pass-community-mcp/pull/148) | TypeScript 7.0.2             | Defer: incompatible lint peer range; CI installation fails with `ERESOLVE`.                          |
| [#145](https://github.com/hesreallyhim/proton-pass-community-mcp/pull/145) | Harden Runner 2.20.0         | Already present at the baseline; superseded here by 2.21.0.                                          |
| [#141](https://github.com/hesreallyhim/proton-pass-community-mcp/pull/141) | CodeQL `init` 4.36.3         | Already present; superseded by synchronized 4.37.9. Do not merge the isolated step bump.             |
| [#140](https://github.com/hesreallyhim/proton-pass-community-mcp/pull/140) | CodeQL `upload-sarif` 4.36.3 | Already present; superseded by synchronized 4.37.9.                                                  |
| [#139](https://github.com/hesreallyhim/proton-pass-community-mcp/pull/139) | CodeQL `analyze` 4.36.3      | Already present; superseded by synchronized 4.37.9. Do not merge the isolated step bump.             |
| [#123](https://github.com/hesreallyhim/proton-pass-community-mcp/pull/123) | CodeQL 4.36.2                | Unnecessary: older than the baseline 4.36.3 and selected 4.37.9.                                     |

The five stale action PRs can be closed as superseded once the consolidated updates are accepted. PRs #153, #154, and #156 can likewise be closed after these changes land. No remote cleanup was performed as part of this local update.

## Validation and remaining operational notes

- Baseline and updated `npm run check` pass: lint, formatting, typecheck, two fuzz tests, and all 158 tests across 10 test files. Coverage is unchanged: 95.14% statements, 83.43% branches, 97.9% functions, and 96.24% lines.
- Manifest/lockfile consistency, installed Node 24 engine compatibility, TypeScript peer compatibility, and Vitest/coverage version alignment were checked.
- Active workflows pass `actionlint`; workflow pin and permission invariants were checked separately, including the dormant templates.
- A final `npm ci` succeeds on Node 24.18.0 and npm 11.16.0, followed by a passing `npm run check:release:package` (lint, typecheck, 158 tests, build, and package dry run).
- `npm audit --json` reports zero known vulnerabilities. `npm ls --depth=0` reports a valid dependency tree; `npm outdated --all --json` has no installed packages below their wanted versions. The remaining `npm-check-updates` proposals are only the deliberately excluded Inspector 2, Node 26 types, and TypeScript 7.
- The Inspector fixture smoke passes: all 47 tool definitions, including schemas, exactly match the baseline response, and `view_session_info` returns `mock-pass-info` before and after the update.
- Complexity thresholds and production hygiene both pass in enforcement mode. `git diff --check` passes, and all 38 active/template action references match their verified release SHAs.

The clean install still emits deprecation notices for Inspector's security-maintenance line and existing transitive packages such as `glob` 7, `inflight`, and `node-domexception`. No incompatible transitive-major overrides were introduced to suppress these notices; the audit result is not a guarantee of absence of vulnerabilities.

The existing `mcp:inspect:smoke` script still asserts an obsolete eight-tool v0.1 surface and excludes mutations. It is not an acceptance gate for the current 47-tool server. The dependency validation instead compares the complete Inspector `tools/list` response before and after the update and calls `view_session_info` through the shell fixture. Updating the old smoke assertions is separate maintenance work.

The two fixture-only Inspector calls can be repeated from the repository root after `npm run build`:

```sh
PASS_CLI_BIN="$PWD/test/fixtures/pass-cli-mock.sh" node_modules/.bin/mcp-inspector --cli --transport stdio --method tools/list -- node dist/index.js
PASS_CLI_BIN="$PWD/test/fixtures/pass-cli-mock.sh" node_modules/.bin/mcp-inspector --cli --transport stdio --method tools/call --tool-name view_session_info -- node dist/index.js
```

The Codacy failures in PRs #153, #154, and #156 report an invalid upload URL/token combination after tests complete. Repository owners should check the Codacy endpoint/token and whether the secret is available to Dependabot runs; no credentials, permissions, or upload-failure behavior were changed here. [Example failed job](https://github.com/hesreallyhim/proton-pass-community-mcp/actions/runs/31981177888/job/95248106287)

The upstream setup-node documentation recommends disabling dependency caches in privileged publishing jobs. This repository's publish job already uses `cache: npm`; that pre-existing hardening concern is noted rather than silently changing the publishing policy. [Upstream publishing guidance](https://github.com/actions/setup-node/blob/v7.0.0/docs/advanced-usage.md)

Proton Pass CLI metadata and behavioral snapshots were not upgraded. The separate non-Dependabot PR #138 proposes CLI 2.3.3; evaluating that behavioral drift is outside this npm/Actions update and requires the repository's approved CLI validation process. No live CLI command, authenticated workflow, package publication, or remote CI run was triggered.

## Rollback

Revert the dependency-update commit to restore `package.json` and `package-lock.json`, then run `npm ci` on Node 24. Revert the separate Actions commit to restore the prior workflow pins. No application behavior, data schema, credentials, or vault data was migrated.
