import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { notifyClient, unwrap, type Ask, type AskInput } from "@/api/client"
import { useSettings } from "@/features/connect/settings"
import { mergeAsks } from "./compose"

type Feed = { asOf: string; asks: Ask[] }

const feedKey = (apiUrl: string) => ["asks", apiUrl] as const

/** Recent asks, kept live: the first read lists them, later reads ask only for what changed since the last `asOf`. */
export const useAsksFeed = (refetchInterval = 2000) => {
  const settings = useSettings()
  const queryClient = useQueryClient()
  const key = feedKey(settings.apiUrl)
  return useQuery({
    queryKey: key,
    enabled: Boolean(settings.apiKey),
    refetchInterval,
    queryFn: async (): Promise<Feed> => {
      const previous = queryClient.getQueryData<Feed>(key)
      const page = unwrap(
        await notifyClient(settings).GET("/api/asks", {
          params: {
            query: previous
              ? { updatedSince: previous.asOf, limit: 100 }
              : { limit: 50 },
          },
        })
      )
      return {
        asOf: page.asOf,
        asks: mergeAsks(previous?.asks ?? [], page._embedded.asks),
      }
    },
  })
}

const useFeedUpdate = () => {
  const settings = useSettings()
  const queryClient = useQueryClient()
  return (ask: Ask) =>
    queryClient.setQueryData<Feed>(feedKey(settings.apiUrl), (feed) =>
      feed ? { ...feed, asks: mergeAsks(feed.asks, [ask]) } : feed
    )
}

export const useSendAsk = () => {
  const settings = useSettings()
  const update = useFeedUpdate()
  return useMutation({
    mutationFn: async (input: AskInput) =>
      unwrap(
        await notifyClient(settings).POST("/api/asks", {
          params: { query: { wait: 0 } },
          body: input,
        })
      ),
    onSuccess: update,
  })
}

export const useCancelAsk = () => {
  const settings = useSettings()
  const update = useFeedUpdate()
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await notifyClient(settings).POST("/api/asks/{id}/cancel", {
          params: { path: { id } },
        })
      ),
    onSuccess: update,
  })
}
