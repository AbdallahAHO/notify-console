import type { Ask, AskInput } from "@/api/client"

/** notify's limits (docs/device-protocol.md); the API answers 400/422 past them. */
export const LIMITS = {
  title: 40,
  body: 160,
  actions: 4,
  action: 12,
  minTtl: 10,
  maxTtl: 86_400,
  defaultTtl: 600,
  to: 20,
} as const

export type AskKind = AskInput["kind"]
export const ASK_KINDS: AskKind[] = [
  "message",
  "notification",
  "approval",
  "question",
]

export type AskDraft = {
  kind: AskKind
  title: string
  body: string
  actions: string[]
  ttl: number
  to: string[]
}
export type DraftErrors = Partial<
  Record<"title" | "body" | "actions" | "ttl" | "to", string>
>

export const takesActions = (kind: AskKind) =>
  kind === "approval" || kind === "question"

export const defaultActions = (kind: AskKind) =>
  kind === "approval"
    ? ["Approve", "Deny"]
    : kind === "question"
      ? ["Yes", "No"]
      : []

export const emptyDraft = (): AskDraft => ({
  kind: "question",
  title: "",
  body: "",
  actions: defaultActions("question"),
  ttl: LIMITS.defaultTtl,
  to: [],
})

/** The API body for a draft, or what's wrong with it: the same rules notify applies. */
export const validateDraft = (
  draft: AskDraft
): { input: AskInput | null; errors: DraftErrors } => {
  const errors: DraftErrors = {}
  const title = draft.title.trim()
  const body = draft.body.trim()
  const actions = draft.actions.map((action) => action.trim()).filter(Boolean)

  if (!title) errors.title = "Required"
  else if (title.length > LIMITS.title)
    errors.title = `At most ${LIMITS.title} characters`
  if (body.length > LIMITS.body)
    errors.body = `At most ${LIMITS.body} characters`
  if (takesActions(draft.kind)) {
    if (actions.length > LIMITS.actions)
      errors.actions = `At most ${LIMITS.actions} actions`
    else if (actions.some((action) => action.length > LIMITS.action))
      errors.actions = `Each action at most ${LIMITS.action} characters`
    else if (draft.kind === "question" && !actions.length)
      errors.actions = "A question needs 1 to 4 actions"
  }
  if (
    !Number.isInteger(draft.ttl) ||
    draft.ttl < LIMITS.minTtl ||
    draft.ttl > LIMITS.maxTtl
  )
    errors.ttl = `${LIMITS.minTtl} to ${LIMITS.maxTtl} seconds`
  if (!draft.to.length) errors.to = "Pick at least one destination or tag"
  else if (draft.to.length > LIMITS.to) errors.to = `At most ${LIMITS.to}`

  if (Object.keys(errors).length) return { input: null, errors }
  return {
    errors,
    input: {
      kind: draft.kind,
      title,
      ttl: draft.ttl,
      to: draft.to,
      ...(body ? { body } : {}),
      ...(takesActions(draft.kind) && actions.length ? { actions } : {}),
    },
  }
}

/** Asks by id, newest first: `incoming` (a poll's changes) replaces what was there. */
export const mergeAsks = (previous: Ask[], incoming: Ask[], cap = 100) => {
  const byId = new Map(previous.map((ask) => [ask.id, ask]))
  incoming.forEach((ask) => byId.set(ask.id, ask))
  return [...byId.values()]
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)
    )
    .slice(0, cap)
}

/** Seconds until an open ask expires, counted from its `expiresAt` (0 once past or final). */
export const secondsLeft = (
  ask: Pick<Ask, "status" | "expiresAt">,
  now = Date.now()
) =>
  ask.status === "open"
    ? Math.max(0, Math.round((Date.parse(ask.expiresAt) - now) / 1000))
    : 0
