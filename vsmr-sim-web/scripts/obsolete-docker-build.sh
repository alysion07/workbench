#!/usr/bin/env bash
set -euo pipefail

TAG="${TAG:-etri-vsmr/vsmr-sim-web:latest}"

echo "[build] Building image: ${TAG}"
docker build -t "${TAG}" .

echo "[build] Done: ${TAG}"
