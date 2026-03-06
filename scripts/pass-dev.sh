#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Default to a project-local session directory so test/development auth does not
# mix with other repositories unless explicitly overridden.
DEFAULT_SESSION_DIR="${PROJECT_ROOT}/.tmp/proton-pass-dev-session"
export PROTON_PASS_SESSION_DIR="${PROTON_PASS_SESSION_DIR:-${PASS_DEV_SESSION_DIR:-${DEFAULT_SESSION_DIR}}}"

# Force a non-keyring key provider by default so project CLI flows do not read
# or write to OS keychain/keyring unless explicitly opted in.
export PROTON_PASS_KEY_PROVIDER="${PROTON_PASS_KEY_PROVIDER:-${PASS_DEV_KEY_PROVIDER:-fs}}"
if [[ "${PROTON_PASS_KEY_PROVIDER}" == "keyring" && "${PASS_DEV_ALLOW_KEYRING:-0}" != "1" ]]; then
  cat >&2 <<'EOF'
Refusing to use PROTON_PASS_KEY_PROVIDER=keyring in pass-dev mode.

This repo workflow is designed to avoid OS keychain access for pass-cli.
Use one of:
  PASS_DEV_KEY_PROVIDER=fs
  PASS_DEV_KEY_PROVIDER=env

If you intentionally want keyring anyway:
  PASS_DEV_ALLOW_KEYRING=1 PASS_DEV_KEY_PROVIDER=keyring scripts/pass-dev.sh ...
EOF
  exit 6
fi

PASS_BIN="${PASS_DEV_CLI_BIN:-${PASS_CLI_BIN:-pass-cli}}"
exec "${PASS_BIN}" "$@"
