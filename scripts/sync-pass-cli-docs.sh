#!/usr/bin/env bash
set -euo pipefail

# Sync a pinned snapshot of upstream Proton Pass CLI docs into this repository.
# Usage:
#   scripts/sync-pass-cli-docs.sh [ref]
# Example:
#   scripts/sync-pass-cli-docs.sh 1.5.2

REPO_URL="https://github.com/protonpass/pass-cli"
REF="${1:-1.5.2}"
OUT_ROOT="docs/upstream/pass-cli"
OUT_DIR="${OUT_ROOT}/${REF}"

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

ARCHIVE_URL="${REPO_URL}/archive/${REF}.tar.gz"
ARCHIVE_FILE="${TMP_DIR}/pass-cli-${REF}.tar.gz"

printf 'Downloading %s\n' "${ARCHIVE_URL}"
curl -fsSL "${ARCHIVE_URL}" -o "${ARCHIVE_FILE}"

tar -xzf "${ARCHIVE_FILE}" -C "${TMP_DIR}"

SRC_DIR="$(find "${TMP_DIR}" -maxdepth 1 -type d -name 'pass-cli-*' | head -n 1)"
if [[ -z "${SRC_DIR}" ]]; then
  echo "Could not locate extracted pass-cli source directory." >&2
  exit 1
fi

if [[ ! -d "${SRC_DIR}/docs/public/docs" ]]; then
  echo "Expected docs/public/docs not found in upstream source." >&2
  exit 1
fi

mkdir -p "${OUT_ROOT}"
rm -rf "${OUT_DIR}"
mkdir -p "${OUT_DIR}"

cp -R "${SRC_DIR}/docs/public/docs" "${OUT_DIR}/"
cp "${SRC_DIR}/docs/public/README.md" "${OUT_DIR}/README.md"
cp "${SRC_DIR}/docs/public/zensical.toml" "${OUT_DIR}/zensical.toml"

FETCHED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
cat > "${OUT_DIR}/SNAPSHOT_METADATA.json" <<EOF
{
  "upstream_repo": "${REPO_URL}",
  "ref": "${REF}",
  "source_archive": "${ARCHIVE_URL}",
  "fetched_at_utc": "${FETCHED_AT}",
  "notes": "Snapshot of docs/public docs for offline reference and drift review."
}
EOF

printf 'Synced upstream docs to %s\n' "${OUT_DIR}"
