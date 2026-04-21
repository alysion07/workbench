#!/usr/bin/env bash
set -euo pipefail

# Load default configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../config/defaults.sh"

TAG="${TAG:-etri-vsmr/vsmr-sim-web:latest}"
PORT="${PORT:-3000}"
# Prefer explicit env overrides, then defaults from config/defaults.sh
VITE_GRPC_URL="${VITE_GRPC_URL:-${DEFAULT_VITE_GRPC_URL}}"
VITE_MINIO_ENDPOINT="${VITE_MINIO_ENDPOINT:-${DEFAULT_VITE_MINIO_ENDPOINT}}"

echo "[run] Image: ${TAG}"
echo "[run] Port:  host ${PORT} -> container 80"
echo "[run] VITE_GRPC_URL=${VITE_GRPC_URL}"
echo "[run] VITE_MINIO_ENDPOINT=${VITE_MINIO_ENDPOINT}"

docker run --rm \
  -p "${PORT}:80" \
  -e "VITE_GRPC_URL=${VITE_GRPC_URL}" \
  -e "VITE_MINIO_ENDPOINT=${VITE_MINIO_ENDPOINT}" \
  "${TAG}"

echo "[run] Done"
