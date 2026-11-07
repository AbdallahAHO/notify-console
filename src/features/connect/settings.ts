import { useSyncExternalStore } from "react"

/** Where the console talks to, and with which key. */
export type Settings = { apiUrl: string; apiKey: string }

const STORAGE_KEY = "notify-console.settings"
const FALLBACK_API_URL = "http://localhost:8787"

/** The deployment's default API URL: `/config.json` (written at container start) beats the build-time env. */
export const defaultApiUrl = (
  runtimeConfig: { apiUrl?: unknown } | null,
  buildEnv: string | undefined
) => {
  const fromRuntime =
    typeof runtimeConfig?.apiUrl === "string" ? runtimeConfig.apiUrl.trim() : ""
  return trimSlash(fromRuntime || buildEnv?.trim() || FALLBACK_API_URL)
}

export const trimSlash = (url: string) => url.replace(/\/+$/, "")

/** Saved settings win over the deployment default; a missing or broken entry falls back to it. */
export const resolveSettings = (
  saved: string | null,
  fallbackApiUrl: string
): Settings => {
  try {
    const parsed = saved ? (JSON.parse(saved) as Partial<Settings>) : {}
    return {
      apiUrl: trimSlash(parsed.apiUrl?.trim() || fallbackApiUrl),
      apiKey: parsed.apiKey?.trim() ?? "",
    }
  } catch {
    return { apiUrl: fallbackApiUrl, apiKey: "" }
  }
}

let deploymentApiUrl = FALLBACK_API_URL
let current: Settings = { apiUrl: FALLBACK_API_URL, apiKey: "" }
const listeners = new Set<() => void>()

const readStorage = () => {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/** Loads `/config.json` (optional) and the saved settings; call once before rendering. */
export const loadSettings = async () => {
  const runtimeConfig = await fetch("/config.json", { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null)
  deploymentApiUrl = defaultApiUrl(
    runtimeConfig,
    import.meta.env.VITE_NOTIFY_API_URL
  )
  current = resolveSettings(readStorage(), deploymentApiUrl)
  return current
}

export const getSettings = () => current

export const getDeploymentApiUrl = () => deploymentApiUrl

export const saveSettings = (next: Settings) => {
  current = {
    apiUrl: trimSlash(next.apiUrl.trim()),
    apiKey: next.apiKey.trim(),
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // storage blocked: settings last for this tab only
  }
  listeners.forEach((listener) => listener())
}

export const forgetSettings = () => {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // nothing stored
  }
  saveSettingsInMemory({ apiUrl: deploymentApiUrl, apiKey: "" })
}

const saveSettingsInMemory = (next: Settings) => {
  current = next
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const useSettings = () =>
  useSyncExternalStore(subscribe, getSettings, getSettings)
