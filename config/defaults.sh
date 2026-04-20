#!/usr/bin/env bash
# Central configuration for default endpoints
# This is the single source of truth for default URLs in shell scripts
# Source this file in other scripts: source "$(dirname "$0")/../config/defaults.sh"

# BFF Server Configuration (Connect-RPC)
export DEFAULT_VITE_BFF_URL="http://192.168.0.74:5992"
export DEFAULT_VITE_TASK_TYPE="mars"

# Supabase Configuration
export DEFAULT_VITE_SUPABASE_URL="https://yarwnwwkcdjcfyjedwyk.supabase.co"
export DEFAULT_VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlhcndud3drY2RqY2Z5amVkd3lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5ODg1OTEsImV4cCI6MjA4MjU2NDU5MX0.6_0zyPX7holpPYcb-GO5Q9roeIFr-TqjyeDrIyO3kyc"
export DEFAULT_VITE_SUPABASE_STORAGE_BUCKET="v-smr"

# Development
export DEFAULT_VITE_DEV_MODE=true
export DEFAULT_VITE_LOG_LEVEL=debug
