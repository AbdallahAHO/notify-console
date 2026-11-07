import { useQuery } from "@tanstack/react-query"
import { notifyClient, unwrap } from "@/api/client"
import { useSettings, type Settings } from "./settings"

/** What a connection check found: the service's health (no key) and whether the key opens `/api`. */
export type ConnectionCheck = { version: string; name: string }

export const checkConnection = async (
  settings: Settings
): Promise<ConnectionCheck> => {
  const client = notifyClient(settings)
  const health = unwrap(await client.GET("/api/health"))
  const root = unwrap(await client.GET("/api"))
  return { version: health.version, name: root.name }
}

/** The live connection state the shell shows; re-checked every 30 s. */
export const useConnection = () => {
  const settings = useSettings()
  return useQuery({
    queryKey: ["connection", settings.apiUrl, Boolean(settings.apiKey)],
    enabled: Boolean(settings.apiKey),
    refetchInterval: 30_000,
    retry: false,
    queryFn: () => checkConnection(settings),
  })
}
