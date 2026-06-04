/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string
  readonly VITE_APP_SUBTITLE: string
  readonly VITE_CLOUDFLARE_PROJECT: string
  readonly VITE_EXPORT_FILENAME: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
