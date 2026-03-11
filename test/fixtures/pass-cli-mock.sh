#!/usr/bin/env bash
set -euo pipefail

cmd1="${1:-}"
cmd2="${2:-}"

if [[ "$cmd1" == "info" ]]; then
  printf 'mock-pass-info\n'
  exit 0
fi

if [[ "$cmd1" == "test" ]]; then
  printf 'mock-pass-test-ok\n'
  exit 0
fi

if [[ "$cmd1" == "--version" ]]; then
  printf '1.6.1 (mock)\n'
  exit 0
fi

if [[ "$cmd1" == "vault" && "$cmd2" == "list" ]]; then
  printf '{"vaults":[{"name":"Work"}]}'
  exit 0
fi

if [[ "$cmd1" == "vault" && "$cmd2" == "member" ]]; then
  printf '{"members":[{"id":"member-1","role":"manager"}]}'
  exit 0
fi

if [[ "$cmd1" == "invite" && "$cmd2" == "list" ]]; then
  printf '{"invites":[{"id":"invite-1","type":"vault"}]}'
  exit 0
fi

if [[ "$cmd1" == "settings" && "$cmd2" == "view" ]]; then
  printf 'Default vault: (none)\nDefault format: human\n'
  exit 0
fi

if [[ "$cmd1" == "item" && "$cmd2" == "list" ]]; then
  printf '[]'
  exit 0
fi

if [[ "$cmd1" == "item" && "$cmd2" == "view" ]]; then
  printf '{"item":"ok"}'
  exit 0
fi

if [[ "$cmd1" == "vault" || "$cmd1" == "item" ]]; then
  printf 'ok\n'
  exit 0
fi

printf 'unsupported command: %s %s\n' "$cmd1" "$cmd2" >&2
exit 2
