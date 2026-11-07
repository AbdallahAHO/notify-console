import { useEffect, useState } from "react"
import type { Ask, Delivery } from "@/api/client"
import { messageOf } from "@/api/client"
import { Mono, PageHeader } from "@/app/page"
import { ago, ErrorAlert, RequireKey } from "@/app/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { secondsLeft } from "./compose"
import { ComposeForm } from "./compose-form"
import { useAsksFeed, useCancelAsk } from "./queries"

const useNow = (everyMs: number) => {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(timer)
  }, [everyMs])
  return now
}

const TONE: Record<string, string> = {
  open: "bg-warning",
  queued: "bg-muted-foreground/40",
  delivered: "bg-info",
  seen: "bg-info",
  answered: "bg-success",
  dismissed: "bg-success",
  retracted: "bg-muted-foreground/40",
  cancelled: "bg-muted-foreground/40",
  expired: "bg-destructive",
  failed: "bg-destructive",
}

const State = ({ state, className }: { state: string; className?: string }) => (
  <span className={cn("inline-flex items-center gap-1.5", className)}>
    <span
      className={cn(
        "size-1.5 shrink-0 rounded-full",
        TONE[state] ?? "bg-muted-foreground/40"
      )}
      aria-hidden
    />
    {state}
  </span>
)

const clock = (seconds: number) =>
  seconds >= 3600
    ? `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
    : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`

const DeliveryChip = ({ delivery }: { delivery: Delivery }) => (
  <span
    className="inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-[11px]"
    title={`${delivery.destinationId} · ${delivery.updatedAt}`}
  >
    <span className="font-medium">{delivery.name}</span>
    <State state={delivery.state} className="text-muted-foreground" />
  </span>
)

const AskRow = ({ ask, now }: { ask: Ask; now: number }) => {
  const cancel = useCancelAsk()
  const left = secondsLeft(ask, now)
  return (
    <li className="flex flex-col gap-2 px-4 py-3" data-status={ask.status}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Badge variant="outline">{ask.kind}</Badge>
        <span className="min-w-0 flex-1 font-medium">{ask.title}</span>
        <State state={ask.status} className="text-xs" />
        <span
          className="font-mono text-[11px] text-muted-foreground tabular-nums"
          title={ask.createdAt}
        >
          {ask.status === "open"
            ? left > 0
              ? `${clock(left)} left`
              : "past ttl"
            : ago(ask.finishedAt ?? ask.createdAt, now)}
        </span>
      </div>
      {ask.body ? (
        <p className="text-xs text-muted-foreground">{ask.body}</p>
      ) : null}
      {ask.actions.length ? (
        <div className="flex flex-wrap gap-1">
          {ask.actions.map((action) => (
            <Badge
              key={action}
              variant={ask.answer === action ? "default" : "secondary"}
            >
              {action}
            </Badge>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5">
        {ask.deliveries.map((delivery) => (
          <DeliveryChip key={delivery.destinationId} delivery={delivery} />
        ))}
        <span className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
          <Mono>{ask.id}</Mono>
          <span>by {ask.sender}</span>
          {ask.status === "open" ? (
            <Button
              variant="ghost"
              size="xs"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate(ask.id)}
            >
              Cancel
            </Button>
          ) : null}
        </span>
      </div>
      {cancel.isError ? (
        <p className="text-xs text-destructive">{messageOf(cancel.error)}</p>
      ) : null}
    </li>
  )
}

const AsksFeed = () => {
  const feed = useAsksFeed()
  const now = useNow(1000)
  if (feed.isPending)
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-20 w-full" />
        ))}
      </div>
    )
  if (feed.isError)
    return <ErrorAlert title="Couldn't load asks" error={feed.error} />
  if (!feed.data.asks.length)
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>No asks yet</EmptyTitle>
          <EmptyDescription>
            Send one and watch its deliveries move: queued → delivered → seen →
            answered.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  return (
    <ul className="divide-y self-start rounded-lg border" aria-label="Asks">
      {feed.data.asks.map((ask) => (
        <AskRow key={ask.id} ask={ask} now={now} />
      ))}
    </ul>
  )
}

export const AsksPage = () => (
  <>
    <PageHeader
      title="Asks"
      description="Every sender's asks, live (polled every 2 s with updatedSince)."
    />
    <RequireKey>
      <div className="grid gap-6 p-6 xl:grid-cols-[26rem_minmax(0,1fr)]">
        <div className="xl:sticky xl:top-6 xl:self-start">
          <ComposeForm />
        </div>
        <AsksFeed />
      </div>
    </RequireKey>
  </>
)
