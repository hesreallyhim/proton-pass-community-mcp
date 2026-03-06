#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXPECTED_ACCOUNT="${1:-${PASS_DEV_EXPECTED_ACCOUNT:-${PASS_DEV_EXPECTED_EMAIL:-}}}"

if [[ -z "${EXPECTED_ACCOUNT}" ]]; then
  cat >&2 <<'EOF'
Missing expected throwaway account identifier.

Usage:
  scripts/pass-dev-preflight.sh throwaway-account-id

Or set:
  PASS_DEV_EXPECTED_ACCOUNT=throwaway-account-id

Legacy fallback:
  PASS_DEV_EXPECTED_EMAIL=throwaway@example.com
EOF
  exit 2
fi

if ! USER_INFO_JSON="$("${SCRIPT_DIR}/pass-dev.sh" user info --output json)"; then
  echo "Could not query Proton Pass user info in dev session." >&2
  exit 3
fi

ACTUAL_ACCOUNT="$(
  printf '%s' "${USER_INFO_JSON}" | node -e '
    const fs = require("node:fs");
    const input = fs.readFileSync(0, "utf8");
    let data;
    try {
      data = JSON.parse(input);
    } catch {
      process.exit(1);
    }

    const visited = new Set();
    function walk(value) {
      if (value === null || value === undefined) return "";
      if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : "";
      }
      if (typeof value !== "object") return "";
      if (visited.has(value)) return "";
      visited.add(value);

      const preferredKeys = [
        "email",
        "Email",
        "username",
        "Username",
        "accountEmail",
        "account_email",
        "user",
        "login",
        "name",
      ];
      for (const key of preferredKeys) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          const candidate = walk(value[key]);
          if (candidate) return candidate;
        }
      }

      for (const child of Object.values(value)) {
        const candidate = walk(child);
        if (candidate) return candidate;
      }
      return "";
    }

    const account = walk(data);
    if (!account) process.exit(1);
    process.stdout.write(account);
  '
)"

if [[ -z "${ACTUAL_ACCOUNT}" ]]; then
  echo "Unable to detect account identifier from 'pass-cli user info --output json'." >&2
  exit 4
fi

ACTUAL_ACCOUNT_NORM="$(printf '%s' "${ACTUAL_ACCOUNT}" | tr '[:upper:]' '[:lower:]')"
EXPECTED_ACCOUNT_NORM="$(printf '%s' "${EXPECTED_ACCOUNT}" | tr '[:upper:]' '[:lower:]')"

if [[ "${ACTUAL_ACCOUNT_NORM}" != "${EXPECTED_ACCOUNT_NORM}" ]]; then
  cat >&2 <<EOF
Refusing to continue: active pass-cli account does not match throwaway target.

Expected: ${EXPECTED_ACCOUNT}
Actual:   ${ACTUAL_ACCOUNT}

Run:
  scripts/pass-dev.sh login
or:
  scripts/pass-dev.sh login --interactive ${EXPECTED_ACCOUNT}
EOF
  exit 5
fi

echo "Pass dev preflight OK (${ACTUAL_ACCOUNT})"
