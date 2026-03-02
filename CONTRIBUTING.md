# Contributing

Thanks for contributing to `proton-pass-community-mcp`.

## Development Setup

1. Use Node.js `24` (`.nvmrc`).
2. Install dependencies:

```bash
npm ci
```

3. Run full local checks before opening a PR:

```bash
npm run check
```

## Scope of Contributions

It is recommended to open an issue regarding any substantial change before beginning to work on a contribution. This is in early phases of development, and the ROADMAP has not yet stabilized. Some general strategic decisions remain unresolved. In the intial release, we have confined the scope to read-only operations. Additional infrastuructre is needed before any destructive operations can be introducted.

Administrative maintainer workflows (release operations, upstream watch triage, metadata upkeep) are documented in `MAINTAINERS.md`.

## Commit and PR Policy

1. Use Conventional Commits for merge-bound work.
2. Keep PR titles in Conventional Commit format (`feat: ...`, `fix: ...`, etc.).
3. Include tests for behavior changes.
4. Keep changes focused and small where practical.

## Working Areas

- Tool registration: `src/server/register-tools.ts`
- Tool handlers: `src/tools/*`
- CLI runner and normalization: `src/pass-cli/*`
- Contract tests: `test/server.test.ts`
