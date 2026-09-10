# Dependency migration report

## Scope and result

Updated the Node dependency manifest and lockfile. This resolves Dependabot alerts 54 and 55 by moving transitive `qs` from 6.15.3 to 6.16.0. `npm audit --omit=dev` reports zero vulnerabilities after the update.

Direct updates: `zod` 4.4.3 → 4.6.1; `@modelcontextprotocol/inspector` 2.4.0 → 2.6.0; `@types/node` 24.13.3 → 26.5.1; `eslint` 10.9.1 → 10.10.0; `globals` 17.11.0 → 17.12.0; `tsx` 4.23.12 → 4.23.13; and `typescript-eslint` 8.68.0 → 8.70.0. Vitest and its V8 coverage provider were upgraded together from 4.1.11 to 5.0.0.

## Major-version risk

`@types/node` 26 and the paired Vitest 5 packages are major updates. Linting, type checking, all 247 tests, V8 coverage, the TypeScript build, and the packed-package smoke test pass without source or configuration changes.

TypeScript 7.0.2 is available but intentionally deferred: `typescript-eslint@8.70.0` supports TypeScript `>=4.8.4 <6.1.0`. Upgrade TypeScript after a compatible `typescript-eslint` release is available, then rerun this validation suite.

## Validation

- `npm run lint`
- `npm run typecheck`
- `npm test` — 11 files, 247 tests passed
- `npm run coverage` — 11 files, 247 tests passed
- `npm run build`
- `npm run check:package:smoke`
- `npm audit --omit=dev --json` — 0 vulnerabilities

## Rollback

Revert the dependency-update commit to restore the former manifest and lockfile resolutions.
