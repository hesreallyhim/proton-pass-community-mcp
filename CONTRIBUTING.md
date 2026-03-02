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

## Runtime Configuration (Developer)

Startup flags:

- `--allow-version-drift`: treat semver mismatch/version-parse uncertainty as compatible for `check_status`

Environment variables:

- `PASS_CLI_BIN`: override CLI binary path/name (default `pass-cli`) - useful for testing when you want to use a mock.
- `PASS_CLI_ALLOW_VERSION_DRIFT`: equivalent env control for `--allow-version-drift` (`true|false`, `1|0`, `yes|no`, `on|off`)

Precedence:

1. `--allow-version-drift` (if explicitly set)
2. `PASS_CLI_ALLOW_VERSION_DRIFT`
3. default `false`

## Validation / QA

Required full check:

```bash
npm run check
```

Optional targeted checks:

```bash
npm run test
npm run typecheck
npm run lint
npm run format:check
```

## Scope of Contributions

It is recommended to open an issue regarding any substantial change before beginning to work on a contribution. This is in early phases of development, and the ROADMAP has not yet stabilized. Some general strategic decisions remain unresolved. In the initial release, we have confined the scope to read-only operations. Additional infrastructure is needed before any destructive operations can be introduced.

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
