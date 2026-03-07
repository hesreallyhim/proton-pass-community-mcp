#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
IMAGE_NAME="${DEMO_IMAGE_NAME:-proton-pass-community-mcp-demo:local}"
CONTAINER_NAME="${DEMO_CONTAINER_NAME:-proton-pass-community-mcp-demo}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required for demo-shell mode." >&2
  exit 2
fi

if ! docker info >/dev/null 2>&1; then
  echo "docker daemon is not reachable. Start Docker Desktop/daemon and retry." >&2
  exit 3
fi

echo "Building demo image (${IMAGE_NAME})..."
docker build -f "${PROJECT_ROOT}/Dockerfile.demo" -t "${IMAGE_NAME}" "${PROJECT_ROOT}"

mkdir -p "${PROJECT_ROOT}/.tmp/proton-pass-dev-session"

echo "Launching demo container with anonymized workspace path /workspace/project ..."

if [[ "$#" -gt 0 ]]; then
  exec docker run --rm -it \
    --name "${CONTAINER_NAME}" \
    -v "${PROJECT_ROOT}:/workspace/project" \
    -v "${PROJECT_ROOT}/.tmp/proton-pass-dev-session:/workspace/project/.tmp/proton-pass-dev-session" \
    -w /workspace/project \
    "${IMAGE_NAME}" "$@"
fi

exec docker run --rm -it \
  --name "${CONTAINER_NAME}" \
  -v "${PROJECT_ROOT}:/workspace/project" \
  -v "${PROJECT_ROOT}/.tmp/proton-pass-dev-session:/workspace/project/.tmp/proton-pass-dev-session" \
  -w /workspace/project \
  "${IMAGE_NAME}" bash -lc "npm ci && exec bash"
