# Dependency maintenance report

## Updated dependencies

- `@modelcontextprotocol/sdk` 1.30.0 → 1.32.1
- `@modelcontextprotocol/inspector` 2.7.0 → 2.10.1
- `@types/node` 26.6.1 → 26.6.5
- `eslint` 10.10.0 → 10.12.0
- `fast-check` 4.10.1 → 4.10.2
- `globals` 17.12.0 → 17.13.0
- `prettier` 3.9.8 → 3.9.10
- `tsx` 4.23.13 → 4.23.15
- `typescript-eslint` 8.70.0 → 8.71.1

The refreshed lockfile also resolves the vulnerable transitive packages `undici`, `ip-address`, `fast-uri`, `brace-expansion`, `proxy-addr`, and `source-map-js`. `npm audit` reports zero vulnerabilities after the update.

## Compatibility and deferred majors

All applied direct dependency updates are patch or minor releases. `@modelcontextprotocol/inspector` 2.10.1 requires Node.js 22.19 or later, which is compatible with the maintained Node.js 25 environment. Its minor update refreshes MCP Inspector transitive packages from 2.0 to 2.2 and removes the legacy-server package, so its smoke test was run explicitly.

TypeScript 7.0.2 is available but was intentionally deferred because it is a major compiler upgrade. Vitest and `@vitest/coverage-v8` remain at 4.1.11; version 5 is intentionally excluded until it supports Node.js 25.

## Validation

- `npm audit` — 0 vulnerabilities
- `npm run lint` — passed
- `npm run typecheck` — passed
- `npm test` — passed (11 files, 247 tests)
- `npm run build` — passed
- `npm run check` — passed (format check, fuzz tests, and coverage included)
- `npm run mcp:inspect:smoke` — passed

## Rollback

Revert the commit containing `package.json`, `package-lock.json`, and this report to restore the prior dependency graph.
