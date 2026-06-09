/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COMMUNITY_URL?: string;
  readonly VITE_MCP_BASE_URL?: string;
  readonly VITE_MCP_API_KEY?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_HYPERACCELERATOR_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
