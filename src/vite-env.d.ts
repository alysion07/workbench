/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GRPC_URL: string;
  readonly VITE_DEV_MODE: string;
  readonly VITE_LOG_LEVEL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
