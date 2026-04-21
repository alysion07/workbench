// Central configuration file for default endpoints
// This is the single source of truth for default URLs
// All other files should import or reference these values

export default {
  // BFF Server Configuration (Connect-RPC)
  VITE_BFF_URL: "http://192.168.0.74:5992",
  VITE_TASK_TYPE: "mars",

  // Supabase Configuration
  VITE_SUPABASE_URL: "https://yarwnwwkcdjcfyjedwyk.supabase.co",
  VITE_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlhcndud3drY2RqY2Z5amVkd3lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5ODg1OTEsImV4cCI6MjA4MjU2NDU5MX0.6_0zyPX7holpPYcb-GO5Q9roeIFr-TqjyeDrIyO3kyc",
  VITE_SUPABASE_STORAGE_BUCKET: "v-smr",

  // Development
  VITE_DEV_MODE: true,
  VITE_LOG_LEVEL: 'debug'
};
