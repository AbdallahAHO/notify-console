import { Add01Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState, type FormEvent } from "react"
import { messageOf } from "@/api/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useDestinations } from "@/features/destinations/queries"
import { cn } from "@/lib/utils"
import {
  ASK_KINDS,
  defaultActions,
  emptyDraft,
  LIMITS,
  takesActions,
  validateDraft,
  type AskDraft,
  type AskKind,
} from "./compose"
import { useSendAsk } from "./queries"

const TTL_PRESETS = [
  { label: "1m", seconds: 60 },
  { label: "10m", seconds: 600 },
  { label: "1h", seconds: 3600 },
  { label: "1d", seconds: 86_400 },
]

const Count = ({ value, max }: { value: string; max: number }) => (
  <span
    className={cn(
      "font-mono text-[11px] tabular-nums",
      value.trim().length > max ? "text-destructive" : "text-muted-foreground"
    )}
  >
    {value.trim().length}/{max}
  </span>
)

const Recipients = ({
  to,
  onChange,
  error,
}: {
  to: string[]
  onChange: (to: string[]) => void
  error?: string
}) => {
  const destinations = useDestinations({}, 10_000)
  const tags = [
    ...new Set(
      destinations.data?.flatMap((destination) => destination.tags) ?? []
    ),
  ].sort()
  const selectedTargets = (prefix: boolean) =>
    to.filter((target) => target.startsWith("tag:") === prefix)

  return (
    <FieldSet data-invalid={Boolean(error) || undefined}>
      <FieldLegend variant="label">To</FieldLegend>
      {destinations.isPending ? (
        <Skeleton className="h-7 w-full" />
      ) : destinations.isError ? (
        <FieldError>{messageOf(destinations.error)}</FieldError>
      ) : !destinations.data.length ? (
        <FieldDescription>
          No destinations yet: enroll one first.
        </FieldDescription>
      ) : (
        <>
          <ToggleGroup
            multiple
            variant="outline"
            spacing={1}
            className="flex-wrap"
            aria-label="Destinations"
            value={selectedTargets(false)}
            onValueChange={(ids) =>
              onChange([...(ids as string[]), ...selectedTargets(true)])
            }
          >
            {destinations.data.map((destination) => (
              <ToggleGroupItem
                key={destination.id}
                value={destination.id}
                title={destination.id}
              >
                {destination.kind === "device" ? (
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      destination.online
                        ? "bg-success"
                        : "bg-muted-foreground/40"
                    )}
                    aria-hidden
                  />
                ) : null}
                {destination.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {tags.length ? (
            <ToggleGroup
              multiple
              variant="outline"
              spacing={1}
              className="flex-wrap"
              aria-label="Tags"
              value={selectedTargets(true)}
              onValueChange={(chosen) =>
                onChange([...selectedTargets(false), ...(chosen as string[])])
              }
            >
              {tags.map((tag) => (
                <ToggleGroupItem
                  key={tag}
                  value={`tag:${tag}`}
                  className="font-mono"
                >
                  tag:{tag}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}
        </>
      )}
      {error ? <FieldError>{error}</FieldError> : null}
    </FieldSet>
  )
}

/** Composes a test ask with the API's limits counted live. */
export const ComposeForm = () => {
  const [draft, setDraft] = useState<AskDraft>(emptyDraft)
  const [touched, setTouched] = useState(false)
  const send = useSendAsk()
  const { input, errors } = validateDraft(draft)
  const shown = touched ? errors : {}
  const set = (patch: Partial<AskDraft>) =>
    setDraft((current) => ({ ...current, ...patch }))

  const setKind = (kind: AskKind) =>
    set({ kind, actions: takesActions(kind) ? defaultActions(kind) : [] })
  const setAction = (index: number, value: string) =>
    set({
      actions: draft.actions.map((action, at) =>
        at === index ? value : action
      ),
    })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (!input) return
    send.mutate(input, {
      onSuccess: (ask) => {
        toast.add({
          title: "Sent",
          description: `${ask.title} → ${ask.deliveries.length} destination${ask.deliveries.length === 1 ? "" : "s"}`,
        })
        setDraft((current) => ({
          ...emptyDraft(),
          kind: current.kind,
          actions: current.actions,
          to: current.to,
          ttl: current.ttl,
        }))
        setTouched(false)
      },
    })
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="contents" noValidate>
        <CardHeader>
          <CardTitle>Send a test ask</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>Kind</FieldLabel>
              <ToggleGroup
                variant="outline"
                aria-label="Kind"
                value={[draft.kind]}
                onValueChange={(value) =>
                  value[0] && setKind(value[0] as AskKind)
                }
              >
                {ASK_KINDS.map((kind) => (
                  <ToggleGroupItem key={kind} value={kind}>
                    {kind}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
            <Recipients
              to={draft.to}
              onChange={(to) => set({ to })}
              error={shown.to}
            />
            <Field data-invalid={Boolean(shown.title) || undefined}>
              <div className="flex items-baseline justify-between">
                <FieldLabel htmlFor="ask-title">Title</FieldLabel>
                <Count value={draft.title} max={LIMITS.title} />
              </div>
              <Input
                id="ask-title"
                aria-invalid={Boolean(shown.title) || undefined}
                value={draft.title}
                onChange={(event) => set({ title: event.target.value })}
                placeholder="Deploy reelandsheet?"
              />
              {shown.title ? <FieldError>{shown.title}</FieldError> : null}
            </Field>
            <Field data-invalid={Boolean(shown.body) || undefined}>
              <div className="flex items-baseline justify-between">
                <FieldLabel htmlFor="ask-body">Body</FieldLabel>
                <Count value={draft.body} max={LIMITS.body} />
              </div>
              <Textarea
                id="ask-body"
                rows={2}
                aria-invalid={Boolean(shown.body) || undefined}
                value={draft.body}
                onChange={(event) => set({ body: event.target.value })}
                placeholder="3 commits behind"
              />
              {shown.body ? <FieldError>{shown.body}</FieldError> : null}
            </Field>
            {takesActions(draft.kind) ? (
              <FieldSet data-invalid={Boolean(shown.actions) || undefined}>
                <div className="flex items-baseline justify-between">
                  <FieldLegend variant="label">Actions</FieldLegend>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {draft.actions.length}/{LIMITS.actions} · ≤{LIMITS.action}{" "}
                    each
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {draft.actions.map((action, index) => (
                    <div key={index} className="flex items-center gap-1">
                      <Input
                        aria-label={`Action ${index + 1}`}
                        aria-invalid={
                          action.trim().length > LIMITS.action || undefined
                        }
                        value={action}
                        onChange={(event) =>
                          setAction(index, event.target.value)
                        }
                      />
                      <Count value={action} max={LIMITS.action} />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Remove action ${index + 1}`}
                        onClick={() =>
                          set({
                            actions: draft.actions.filter(
                              (_, at) => at !== index
                            ),
                          })
                        }
                      >
                        <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                      </Button>
                    </div>
                  ))}
                </div>
                {draft.actions.length < LIMITS.actions ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="self-start"
                    onClick={() => set({ actions: [...draft.actions, ""] })}
                  >
                    <HugeiconsIcon
                      icon={Add01Icon}
                      strokeWidth={2}
                      data-icon="inline-start"
                    />
                    Add action
                  </Button>
                ) : null}
                {shown.actions ? (
                  <FieldError>{shown.actions}</FieldError>
                ) : draft.kind === "approval" && !draft.actions.length ? (
                  <FieldDescription>
                    Empty: the API uses Approve / Deny.
                  </FieldDescription>
                ) : null}
              </FieldSet>
            ) : null}
            <Field data-invalid={Boolean(shown.ttl) || undefined}>
              <FieldLabel htmlFor="ask-ttl">Expires after (seconds)</FieldLabel>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="ask-ttl"
                  type="number"
                  min={LIMITS.minTtl}
                  max={LIMITS.maxTtl}
                  className="w-28 font-mono"
                  aria-invalid={Boolean(shown.ttl) || undefined}
                  value={Number.isNaN(draft.ttl) ? "" : draft.ttl}
                  onChange={(event) => set({ ttl: event.target.valueAsNumber })}
                />
                {TTL_PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    variant={
                      draft.ttl === preset.seconds ? "secondary" : "ghost"
                    }
                    size="sm"
                    onClick={() => set({ ttl: preset.seconds })}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              {shown.ttl ? <FieldError>{shown.ttl}</FieldError> : null}
            </Field>
          </FieldGroup>
          {send.isError ? (
            <p className="mt-3 text-xs text-destructive">
              {messageOf(send.error)}
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={send.isPending}>
            {send.isPending ? <Spinner data-icon="inline-start" /> : null}
            Send
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
