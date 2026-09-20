# Dependency maintenance report

## Updates

- Updated `zod` to 4.6.5.
- Updated development tooling within compatible major versions: `@modelcontextprotocol/inspector` to 2.7.0, `@types/node` to 26.6.2, `eslint` to 10.11.0, `fast-check` to 4.10.2, `globals` to 17.12.0, `prettier` to 3.9.8, `tsx` to 4.23.13, and `typescript-eslint` to 8.70.0.
- Updated the transitive `qs` dependency to 6.16.0, resolving GHSA-x5fp-wj9c-mxmx and GHSA-4mjr-xmp4-gh2g.
- Updated pinned `github/codeql-action` `init`, `analyze`, and `upload-sarif` references from 4.37.9 to 4.38.0.

## Compatibility and risk notes

- `@types/node` is the only included major update (24 to 26). It is development-only and type checking passes, but it may permit references to Node 26 APIs while the package runtime minimum remains Node 24.
- `@modelcontextprotocol/inspector` requires Node 22.19 or newer; Node 25 remains supported.
- `vitest` and `@vitest/coverage-v8` intentionally remain at 4.1.11. Version 5 is deferred until it supports Node 25.
- TypeScript 7 and the `cloc` prerelease are intentionally excluded as unrelated major/prerelease updates.

## Validation

- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm run check`
- `npm run build`
- `npm run check:package:smoke`
- `npm run mcp:inspect:smoke`
- `npm audit --json` (zero vulnerabilities)
