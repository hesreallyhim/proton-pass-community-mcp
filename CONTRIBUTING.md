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
npm run check:package:smoke
npm run mcp:inspect:smoke
```

## Runtime Configuration (Developer)

Startup flags:

- `--allow-version-drift`: treat semver mismatch/version-parse uncertainty as compatible for `check_status`

Environment variables:

- `PASS_CLI_BIN`: override CLI binary path/name (default `pass-cli`) - useful for testing when you want to use a mock.
- `PASS_CLI_ALLOW_VERSION_DRIFT`: equivalent env control for `--allow-version-drift` (`true|false`, `1|0`, `yes|no`, `on|off`)
- `ALLOW_WRITE=1`: allow mutating tools, still requiring `confirm: true` per call. Attachment downloads are included because they write local files.
- `PROTON_PASS_AGENT_REASON`: optional inherited CLI reason. Prefer each tool's `agentReason` for request-specific explanations. The four tools with a required `agentReason` input do not accept this environment variable as a substitute.

Disposable test account workflow:

- Use the repo wrapper as the canonical entrypoint for project-side Proton Pass CLI calls.
- Shorthand aliases:
  - `npm run pass -- ...` (preferred npm entrypoint)
  - `scripts/pass ...` (shell wrapper)
  - `scripts/pass-dev.sh ...` (direct wrapper)
- Do not use bare `pass-cli` for normal project development/testing unless you are intentionally bypassing the repo safety conventions.
- For anonymized demo sessions, use `npm run demo:shell` (container path: `/workspace/project`).
- `scripts/pass-dev.sh` defaults to `PROTON_PASS_KEY_PROVIDER=fs` and avoids keyring/keychain access unless explicitly overridden.
- Repo-local session isolation prevents accidental reuse of your default desktop/session state, but it does not by itself guarantee the correct account; use `scripts/pass-dev-preflight.sh` to assert the expected throwaway account before integration/destructive testing.
- Full local + CI workflow is documented in `docs/testing/TEST_ACCOUNT_WORKFLOW.md`.
- MCP integration auth options and one-time provider validation (`keyring`, `fs`, `env`) are also documented in `docs/testing/TEST_ACCOUNT_WORKFLOW.md`.

Precedence:

1. `--allow-version-drift` (if explicitly set)
2. `PASS_CLI_ALLOW_VERSION_DRIFT`
3. default `false`

## Validation / QA

During rehabilitation, use static source inspection and fixtures only. Do not run the template drift/probe scripts or authenticated wrappers until a maintainer explicitly approves a live smoke check.

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
npm run check:release:package
npm run mcp:inspect:smoke
```

`check:package:smoke` packs the build, installs it with production dependencies into a temporary consumer, and exercises MCP initialization, all 47 tool registrations, the seven template resources, read output, per-call audit reasons, and write rejection. Both smoke scripts use an isolated Node fixture and cannot select the real CLI from ambient `PASS_CLI_BIN`.

### Inspector 2

`npm run mcp:inspect` starts the Inspector web UI for the local build. Inspector 2 does not forward arbitrary shell environment variables to the server automatically. Pass each server variable explicitly, for example:

```bash
npm run mcp:inspect -- -e PASS_CLI_BIN=/absolute/path/to/approved-fixture
```

Use `npm run mcp:inspect:smoke` for the fully isolated, noninteractive fixture check. If a live session is explicitly approved, forward its CLI binary/session configuration deliberately; never rely on a shell-only fixture override. The v2 CLI uses `mcp-inspector <server command> -- <Inspector options>`; the web mode uses `--web`.

## Scope of Contributions

It is recommended to open an issue regarding any substantial change before beginning to work on a contribution. The current rehabilitation preserves the existing 47-tool surface, including gated writes. The elicitation-based authorization design in the tool schema plan remains a proposal; do not infer that it is implemented from the roadmap.

Administrative maintainer workflows (release operations, upstream watch triage, metadata upkeep) are documented in `MAINTAINERS.md`.

## Commit and PR Policy

1. Use Conventional Commits for merge-bound work.
2. Keep PR titles in Conventional Commit format (`feat: ...`, `fix: ...`, etc.).
3. Include tests for behavior changes.
4. Keep changes focused and small where practical.

Changes that add or materially alter runtime behavior, schemas, tool contracts, CLI argument construction, or user-visible output should include automated tests. If automated tests are not practical for a change, the PR should explain why and describe the manual validation performed.

## Working Areas

- Tool registration: `src/server/register-tools.ts`
- Tool handlers: `src/tools/*`
- CLI runner and normalization: `src/pass-cli/*`
- Contract tests: `test/server.test.ts`
