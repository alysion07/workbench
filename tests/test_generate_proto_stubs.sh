#!/usr/bin/env bash
set -euo pipefail

# CI-friendly test for proto stub generation script.
# Verifies:
# 1) Generation creates expected files
# 2) Re-run without --force does not change mtimes (up-to-date skip)
# 3) Re-run with --force updates mtimes

# Resolve repo root (parent of this tests directory)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${SCRIPT_DIR}/.."
PROTO_SCRIPT="${ROOT_DIR}/2-generate-proto-stubs.sh"
OUT_DIR="${ROOT_DIR}/src/proto"
PB_JS="${OUT_DIR}/task_manager_pb.js"
PB_GRPC_WEB="${OUT_DIR}/task_manager_grpc_web_pb.js"
BAD_DIR="${OUT_DIR}/proto"

# Docker availability check
if ! command -v docker >/dev/null 2>&1; then
  echo "SKIP: docker not available"
  exit 0
fi
if ! docker info >/dev/null 2>&1; then
  echo "SKIP: docker not usable in this environment"
  exit 0
fi

echo "[test] Cleaning previous outputs..."
rm -f "${PB_JS}" "${PB_GRPC_WEB}"
# Ensure nested directory from any prior runs is removed so we can detect regressions
rm -rf "${BAD_DIR}"

# 1) First generation
echo "[test] First generation..."
"${PROTO_SCRIPT}"
[[ -f "${PB_JS}" ]] || { echo "[test][FAIL] Missing ${PB_JS}"; exit 1; }
[[ -f "${PB_GRPC_WEB}" ]] || { echo "[test][FAIL] Missing ${PB_GRPC_WEB}"; exit 1; }
# Regression check: outputs must not be placed under src/proto/proto/
if [[ -d "${BAD_DIR}" ]]; then
  echo "[test][FAIL] Unexpected directory exists: ${BAD_DIR} (outputs should be written directly to ${OUT_DIR})"
  exit 1
fi

# Helper to get mtime (Linux GNU stat or macOS BSD stat)
mtime() {
  local p="$1"
  if stat -c %Y "$p" >/dev/null 2>&1; then
    stat -c %Y "$p"
  else
    stat -f %m "$p"
  fi
}

T1_PB_JS=$(mtime "${PB_JS}")
T1_PB_GRPC_WEB=$(mtime "${PB_GRPC_WEB}")

echo "[test] Re-run without --force (should skip)..."
"${PROTO_SCRIPT}"
T2_PB_JS=$(mtime "${PB_JS}")
T2_PB_GRPC_WEB=$(mtime "${PB_GRPC_WEB}")
if [[ "${T2_PB_JS}" != "${T1_PB_JS}" || "${T2_PB_GRPC_WEB}" != "${T1_PB_GRPC_WEB}" ]]; then
  echo "[test][FAIL] mtimes changed on non-forced run (${T1_PB_JS},${T1_PB_GRPC_WEB}) -> (${T2_PB_JS},${T2_PB_GRPC_WEB})"
  exit 1
fi

# Ensure timestamp change granularity
sleep 1

echo "[test] Re-run with --force (should regenerate)..."
"${PROTO_SCRIPT}" --force
T3_PB_JS=$(mtime "${PB_JS}")
T3_PB_GRPC_WEB=$(mtime "${PB_GRPC_WEB}")
if [[ "${T3_PB_JS}" == "${T1_PB_JS}" || "${T3_PB_GRPC_WEB}" == "${T1_PB_GRPC_WEB}" ]]; then
  echo "[test][FAIL] mtimes did not change after forced run"
  exit 1
fi

# Regression check after forced run: ensure no nested proto directory was created
if [[ -d "${BAD_DIR}" ]]; then
  echo "[test][FAIL] Unexpected directory exists after forced run: ${BAD_DIR} (outputs should be written directly to ${OUT_DIR})"
  exit 1
fi

echo "[test][PASS] Proto stub generation script behaves as expected."
