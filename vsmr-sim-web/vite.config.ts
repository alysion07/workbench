import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import defaults from './config/defaults'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')

  const resolved = {
    VITE_BFF_URL: String(process.env.VITE_BFF_URL ?? env.VITE_BFF_URL ?? defaults.VITE_BFF_URL),
    VITE_TASK_TYPE: String(process.env.VITE_TASK_TYPE ?? env.VITE_TASK_TYPE ?? defaults.VITE_TASK_TYPE),
    VITE_DEV_MODE: String(process.env.VITE_DEV_MODE ?? env.VITE_DEV_MODE ?? defaults.VITE_DEV_MODE),
    VITE_LOG_LEVEL: String(process.env.VITE_LOG_LEVEL ?? env.VITE_LOG_LEVEL ?? defaults.VITE_LOG_LEVEL),
    // Supabase
    VITE_SUPABASE_URL: String(process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? defaults.VITE_SUPABASE_URL),
    VITE_SUPABASE_ANON_KEY: String(process.env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY ?? defaults.VITE_SUPABASE_ANON_KEY),
    VITE_SUPABASE_STORAGE_BUCKET: String(process.env.VITE_SUPABASE_STORAGE_BUCKET ?? env.VITE_SUPABASE_STORAGE_BUCKET ?? defaults.VITE_SUPABASE_STORAGE_BUCKET),
  }

  const validateUrl = (name: string, value: string) => {
    try {
      // Throws if value is not a valid absolute URL
      new URL(value)
    } catch {
      throw new Error(
        `Invalid URL for ${name}: "${value}". Please check your environment variables, .env files, or config/defaults.js.`
      )
    }
  }

  validateUrl('VITE_BFF_URL', resolved.VITE_BFF_URL)

  return {
    plugins: [
      react(),
      nodePolyfills({
        include: ['buffer', 'process', 'util', 'stream'],
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      }),
    ],
    build: {
      sourcemap: true,
      rollupOptions: {
        external: ['env.js'],
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: ['vsmrtest2.r-e.kr'],
    },
    preview: {
      port: 3000,
    },
    optimizeDeps: {
      include: ['google-protobuf', 'grpc-web'],
    },
    // Inject build-time defaults similar to webpack DefinePlugin
    define: {
      'import.meta.env.VITE_BFF_URL': JSON.stringify(resolved.VITE_BFF_URL),
      'import.meta.env.VITE_TASK_TYPE': JSON.stringify(resolved.VITE_TASK_TYPE),
      'import.meta.env.VITE_DEV_MODE': JSON.stringify(resolved.VITE_DEV_MODE),
      'import.meta.env.VITE_LOG_LEVEL': JSON.stringify(resolved.VITE_LOG_LEVEL),
      // Supabase
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(resolved.VITE_SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(resolved.VITE_SUPABASE_ANON_KEY),
      'import.meta.env.VITE_SUPABASE_STORAGE_BUCKET': JSON.stringify(resolved.VITE_SUPABASE_STORAGE_BUCKET),
    },
  }
})
