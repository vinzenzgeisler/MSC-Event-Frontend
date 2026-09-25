/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv { readonly VITE_ENABLE_RACEPIC?: string }
interface ImportMeta { readonly env: ImportMetaEnv }

interface Window {
  __MSC_RUNTIME_CONFIG__?: Record<string, string | boolean | null | undefined>;
}
