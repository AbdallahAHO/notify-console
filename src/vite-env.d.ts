/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The notify API this build points at by default (overridable in Connect). */
  readonly VITE_NOTIFY_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
