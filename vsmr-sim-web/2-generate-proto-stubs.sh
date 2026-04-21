#!/usr/bin/env bash

set -euo pipefail

# Generate JavaScript gRPC-Web stubs from proto
# Requirements:
# - Either Docker installed and running (preferred), or local protoc + grpc-web plugin available
# - This script can be executed from any directory

# Default image (can be overridden via CLI --image or env PROTOC_IMAGE/IMAGE)
IMAGE_DEFAULT="ghcr.io/etri-vsmr/protoc-js:latest"
IMAGE="${PROTOC_IMAGE:-${IMAGE:-${IMAGE_DEFAULT}}}"

# CLI options
FORCE=true

usage() {
	cat <<'USAGE'
Usage: ./2-generate-proto-stubs.sh [--force] [--image <container-image>]

Options:
  --force               Regenerate unconditionally (ignore timestamps)
  --image <image>       Override container image (env PROTOC_IMAGE or IMAGE also accepted)

Examples:
  ./2-generate-proto-stubs.sh
  ./2-generate-proto-stubs.sh --force
  ./2-generate-proto-stubs.sh --image ghcr.io/etri-vsmr/protoc-js:latest
USAGE
}

# Parse arguments
ARGS=("$@")
idx=0
while [[ $idx -lt ${#ARGS[@]} ]]; do
	arg="${ARGS[$idx]}"
	case "$arg" in
		-h|--help)
			usage
			exit 0
			;;
		-f|--force)
			FORCE=true
			;;
		--image)
			((idx++)) || true
			if [[ $idx -ge ${#ARGS[@]} ]]; then
				echo "Error: --image requires a value" >&2
				exit 2
			fi
			IMAGE="${ARGS[$idx]}"
			;;
		--image=*)
			IMAGE="${arg#*=}"
			;;
		--)
			break
			;;
		*)
			echo "Error: Unknown option: $arg" >&2
			usage
			exit 2
			;;
	esac
	((idx++)) || true
done

# Resolve repository root (directory of this script)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${SCRIPT_DIR}"

PROTO_FILE_REL="proto/task_manager.proto"
PROTO_FILE="${ROOT_DIR}/${PROTO_FILE_REL}"
OUT_DIR_REL="src/proto"
OUT_DIR="${ROOT_DIR}/${OUT_DIR_REL}"

JS_PB="${OUT_DIR}/task_manager_pb.js"
JS_GRPC_WEB="${OUT_DIR}/task_manager_grpc_web_pb.js"

echo "[proto] Using image (when docker): ${IMAGE}"
echo "[proto] Repo root: ${ROOT_DIR}"
echo "[proto] Proto file: ${PROTO_FILE_REL}"
echo "[proto] Output dir: ${OUT_DIR_REL}"

# Determine host path to mount into the container.
# On Git Bash / MSYS / Cygwin, prefer a Windows-style path (pwd -W or cygpath -w)
# to avoid Docker interpreting the working directory incorrectly.
HOST_ROOT="${ROOT_DIR}"
UNAME_LOWER="$(uname -s 2>/dev/null | tr '[:upper:]' '[:lower:]' || true)"
if [[ "${UNAME_LOWER}" =~ mingw|msys|cygwin ]]; then
	# Try pwd -W (Git for Windows). If not available, fallback to cygpath.
	if WIN_PWD=$(pwd -W 2>/dev/null || true) && [[ -n "${WIN_PWD}" ]]; then
		HOST_ROOT="${WIN_PWD}"
	else
		# cygpath -w should exist on Cygwin-like environments
		if command -v cygpath >/dev/null 2>&1; then
			HOST_ROOT=$(cygpath -w "${ROOT_DIR}")
		fi
	fi
fi

HAS_DOCKER=false
if command -v docker >/dev/null 2>&1; then
	HAS_DOCKER=true
	echo "[proto] Host mount: ${HOST_ROOT} -> /workspace (in container)"
fi

if [[ ! -f "${PROTO_FILE}" ]]; then
	echo "Error: proto file not found at ${PROTO_FILE_REL}" >&2
	exit 1
fi

mkdir -p "${OUT_DIR}"

# Determine if regeneration is needed
needs_regen() {
	# If forced, always true
	${FORCE} && return 0
	# If outputs missing, need regen
	[[ -f "${JS_PB}" && -f "${JS_GRPC_WEB}" ]] || return 0
	# Compare mtimes: if proto newer than either output, need regen
	# Use stat portable approach for Linux/macOS; Git Bash typically has GNU stat
	get_mtime() {
		local p="$1"
		if stat -c %Y "$p" >/dev/null 2>&1; then
			stat -c %Y "$p"
		else
			# macOS BSD stat
			stat -f %m "$p"
		fi
	}
	local t_proto t_pb t_pbgrpc
	t_proto=$(get_mtime "${PROTO_FILE}")
	t_pb=$(get_mtime "${JS_PB}")
	t_pbgrpc=$(get_mtime "${JS_GRPC_WEB}")
	if [[ "$t_proto" -gt "$t_pb" || "$t_proto" -gt "$t_pbgrpc" ]]; then
		return 0
	fi
	return 1
}

if ! needs_regen; then
	echo "[proto] Stubs are up-to-date; use --force to regenerate."
	echo " - ${JS_PB}"
	echo " - ${JS_GRPC_WEB}"
	exit 0
fi

if ${HAS_DOCKER}; then
	# Run protoc inside the container, mount repo at /workspace
	echo "[proto] Generating JS gRPC-Web stubs via container..."
	# If running under MSYS/MinGW/Cygwin, avoid automatic path conversion of
	# arguments by setting MSYS_NO_PATHCONV=1 for the docker invocation.
	if [[ "${UNAME_LOWER}" =~ mingw|msys|cygwin ]]; then
		echo "[proto] MSYS detected — exporting MSYS_NO_PATHCONV=1 for docker invocation"
		export MSYS_NO_PATHCONV=1
		docker run --rm \
			-v "${HOST_ROOT}:/workspace" \
			-w /workspace \
			"${IMAGE}" \
			sh -c "protoc -I=proto proto/task_manager.proto \
				--js_out=import_style=commonjs:/workspace/${OUT_DIR_REL} \
				--grpc-web_out=import_style=commonjs,mode=grpcwebtext:/workspace/${OUT_DIR_REL} \
				--ts_out=/workspace/${OUT_DIR_REL} \
				--ts_opt=target=web"
		unset MSYS_NO_PATHCONV || true
	else
		docker run --rm \
			-v "${HOST_ROOT}:/workspace" \
			-w /workspace \
			"${IMAGE}" \
			sh -c "protoc -I=proto proto/task_manager.proto \
				--js_out=import_style=commonjs:/workspace/${OUT_DIR_REL} \
				--grpc-web_out=import_style=commonjs,mode=grpcwebtext:/workspace/${OUT_DIR_REL} \
				--ts_out=/workspace/${OUT_DIR_REL} \
				--ts_opt=target=web"
	fi
else
	# Fallback: attempt local generation (non-container environment)
	echo "[proto] Docker not found. Attempting local protoc generation..."
	if ! command -v protoc >/dev/null 2>&1; then
		echo "Error: protoc not found on PATH. Install protoc and grpc-web plugin or enable Docker." >&2
		echo "Hint (local): protoc -I=proto proto/task_manager.proto \\
  --js_out=import_style=commonjs:src/proto \\
  --grpc-web_out=import_style=commonjs,mode=grpcwebtext:src/proto \\
  --ts_out=src/proto \\
  --ts_opt=target=web" >&2
		exit 1
	fi
	(
		cd "${ROOT_DIR}"
		protoc -I=proto proto/task_manager.proto \
			--js_out=import_style=commonjs:${OUT_DIR_REL} \
			--grpc-web_out=import_style=commonjs,mode=grpcwebtext:${OUT_DIR_REL} \
			--ts_out=${OUT_DIR_REL} \
			--ts_opt=target=web
	)
fi

# Verify outputs
if [[ ! -f "${JS_PB}" || ! -f "${JS_GRPC_WEB}" ]]; then
	echo "Error: Stub generation failed. Expected files not found:" >&2
	[[ -f "${JS_PB}" ]] || echo " - ${JS_PB}" >&2
	[[ -f "${JS_GRPC_WEB}" ]] || echo " - ${JS_GRPC_WEB}" >&2
	exit 1
fi

echo "[proto] ✅ Stubs generated:"
echo " - ${JS_PB}"
echo " - ${JS_GRPC_WEB}"
