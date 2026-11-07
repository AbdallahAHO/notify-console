import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { notifyClient, unwrap, type Destination } from "@/api/client"
import { useSettings } from "@/features/connect/settings"

export type DestinationFilter = {
  kind?: "device" | "webhook"
  includeRevoked?: boolean
}

const KEY = "destinations"

export const useDestinations = (
  filter: DestinationFilter = {},
  refetchInterval: number | false = 5000
) => {
  const settings = useSettings()
  return useQuery({
    queryKey: [KEY, settings.apiUrl, "list", filter],
    enabled: Boolean(settings.apiKey),
    refetchInterval,
    queryFn: async () =>
      unwrap(
        await notifyClient(settings).GET("/api/destinations", {
          params: {
            query: {
              kind: filter.kind,
              includeRevoked: filter.includeRevoked ? "true" : "false",
              limit: 100,
            },
          },
        })
      )._embedded.destinations,
  })
}

export const useDestination = (
  id: string,
  refetchInterval: number | false = 5000
) => {
  const settings = useSettings()
  return useQuery({
    queryKey: [KEY, settings.apiUrl, "one", id],
    enabled: Boolean(settings.apiKey && id),
    refetchInterval,
    queryFn: async () =>
      unwrap(
        await notifyClient(settings).GET("/api/destinations/{id}", {
          params: { path: { id } },
        })
      ),
  })
}

/** Refreshes every destinations query after a change. */
export const useDestinationsRefresh = () => {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: [KEY] })
}

export const useUpdateDestination = () => {
  const settings = useSettings()
  const refresh = useDestinationsRefresh()
  return useMutation({
    mutationFn: async ({
      id,
      name,
      tags,
    }: {
      id: string
      name: string
      tags: string[]
    }) =>
      unwrap(
        await notifyClient(settings).PATCH("/api/destinations/{id}", {
          params: { path: { id } },
          body: { name, tags },
        })
      ),
    onSuccess: refresh,
  })
}

export const useRevokeDestination = () => {
  const settings = useSettings()
  const refresh = useDestinationsRefresh()
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await notifyClient(settings).DELETE(
        "/api/destinations/{id}",
        { params: { path: { id } } }
      )
      unwrap(result)
    },
    onSuccess: refresh,
  })
}

export type { Destination }
