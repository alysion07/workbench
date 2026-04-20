// This file is used at container runtime to render env.js
// Default values are defined in config/defaults.js and config/defaults.sh
// Replace placeholders with environment variables in your entrypoint script
// Example (sh):
//   source config/defaults.sh
//   export VITE_GRPC_URL="${VITE_GRPC_URL:-${DEFAULT_VITE_GRPC_URL}}"
//   export VITE_MINIO_ENDPOINT="${VITE_MINIO_ENDPOINT:-${DEFAULT_VITE_MINIO_ENDPOINT}}"
//   envsubst < /usr/share/nginx/html/env.template.js > /usr/share/nginx/html/env.js

window.__ENV = Object.assign({}, window.__ENV || {}, {
  // BFF Server Configuration (Connect-RPC)
  VITE_BFF_URL: "${VITE_BFF_URL}",
  VITE_TASK_TYPE: 'mars',

  // Supabase Configuration
  // VITE_SUPABASE_URL: "${VITE_SUPABASE_URL}",
  // VITE_SUPABASE_ANON_KEY: "${VITE_SUPABASE_ANON_KEY}",
  // VITE_SUPABASE_STORAGE_BUCKET: "${VITE_SUPABASE_STORAGE_BUCKET}",

  // Development
  VITE_DEV_MODE: "${VITE_DEV_MODE}",
  VITE_LOG_LEVEL: "${VITE_LOG_LEVEL}"
});
