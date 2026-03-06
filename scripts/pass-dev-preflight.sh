#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXPECTED_EMAIL="${1:-${PASS_DEV_EXPECTED_EMAIL:-}}"

if [[ -z "${EXPECTED_EMAIL}" ]]; then
  cat >&2 <<'EOF'
Missing expected throwaway account email.

Usage:
  scripts/pass-dev-preflight.sh throwaway@proton.me

Or set:
  PASS_DEV_EXPECTED_EMAIL=throwaway@proton.me
EOF
  exit 2
fi

if ! USER_INFO_JSON="$("${SCRIPT_DIR}/pass-dev.sh" user info --output json)"; then
  echo "Could not query Proton Pass user info in dev session." >&2
  exit 3
fi

ACTUAL_EMAIL="$(
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
        return value.includes("@") ? value : "";
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

    const email = walk(data);
    if (!email) process.exit(1);
    process.stdout.write(email);
  '
)"

if [[ -z "${ACTUAL_EMAIL}" ]]; then
  echo "Unable to detect account email from 'pass-cli user info --output json'." >&2
  exit 4
fi

if [[ "${ACTUAL_EMAIL,,}" != "${EXPECTED_EMAIL,,}" ]]; then
  cat >&2 <<EOF
Refusing to continue: active pass-cli account does not match throwaway target.

Expected: ${EXPECTED_EMAIL}
Actual:   ${ACTUAL_EMAIL}

Run:
  scripts/pass-dev.sh login
or:
  scripts/pass-dev.sh login --interactive ${EXPECTED_EMAIL}
EOF
  exit 5
fi

echo "Pass dev preflight OK (${ACTUAL_EMAIL})"
