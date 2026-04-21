#!/usr/bin/env sh
set -eu

# Load defaults from config file
# Defaults are copied into the container at build time
if [ -f /app/config/defaults.sh ]; then
  . /app/config/defaults.sh
fi

# Use environment variables or fall back to defaults

# BFF Server Configuration (Connect-RPC)
export VITE_BFF_URL="${VITE_BFF_URL:-${DEFAULT_VITE_BFF_URL}}"
export VITE_TASK_TYPE="${VITE_TASK_TYPE:-${DEFAULT_VITE_TASK_TYPE}}"

# Supabase Configuration
export VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-${DEFAULT_VITE_SUPABASE_URL}}"
export VITE_SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY:-${DEFAULT_VITE_SUPABASE_ANON_KEY}}"
export VITE_SUPABASE_STORAGE_BUCKET="${VITE_SUPABASE_STORAGE_BUCKET:-${DEFAULT_VITE_SUPABASE_STORAGE_BUCKET}}"

# Development
export VITE_DEV_MODE="${VITE_DEV_MODE:-${DEFAULT_VITE_DEV_MODE}}"
export VITE_LOG_LEVEL="${VITE_LOG_LEVEL:-${DEFAULT_VITE_LOG_LEVEL}}"

# Render env.js from template into the served html directory
if [ -f /usr/share/nginx/html/env.template.js ]; then
  echo "[entrypoint] Rendering env.js from template with current environment"
  # Using envsubst to replace placeholders
  envsubst '${VITE_BFF_URL} \
            ${VITE_TASK_TYPE} \
            ${VITE_DEV_MODE} \
            ${VITE_LOG_LEVEL}' \
            < /usr/share/nginx/html/env.template.js \
            > /usr/share/nginx/html/env.js
else
  echo "[entrypoint] ERROR: env.template.js not found; failing container startup" >&2
  exit 1
fi
