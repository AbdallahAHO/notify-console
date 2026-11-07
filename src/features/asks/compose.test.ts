import { describe, expect, it } from "vitest"
import { askFixture } from "@/test/fixtures"
import {
  emptyDraft,
  mergeAsks,
  secondsLeft,
  validateDraft,
  type AskDraft,
} from "./compose"

const draft = (overrides: Partial<AskDraft> = {}): AskDraft => ({
  ...emptyDraft(),
  title: "Deploy?",
  to: ["tag:desk"],
  ...overrides,
})

describe("validateDraft", () => {
  it("builds the API body a question needs", () => {
    expect(
      validateDraft(
        draft({ body: "  3 behind ", actions: ["Yes", " No ", ""] })
      ).input
    ).toEqual({
      kind: "question",
      title: "Deploy?",
      body: "3 behind",
      actions: ["Yes", "No"],
      ttl: 600,
      to: ["tag:desk"],
    })
  })

  it("enforces the device limits: title 40, body 160, 4 actions of 12", () => {
    const { errors } = validateDraft(
      draft({
        title: "x".repeat(41),
        body: "y".repeat(161),
        actions: ["a", "b", "c", "d", "e"],
      })
    )
    expect(errors).toEqual({
      title: "At most 40 characters",
      body: "At most 160 characters",
      actions: "At most 4 actions",
    })
    expect(
      validateDraft(draft({ actions: ["Thirteen chrs"] })).errors.actions
    ).toBe("Each action at most 12 characters")
  })

  it("needs a recipient, a title, a question action and a ttl in range", () => {
    const { errors } = validateDraft(
      draft({ title: " ", to: [], actions: [], ttl: 5 })
    )
    expect(Object.keys(errors).sort()).toEqual([
      "actions",
      "title",
      "to",
      "ttl",
    ])
  })

  it("sends no actions for messages and notifications, and lets approvals default", () => {
    expect(
      validateDraft(draft({ kind: "message", actions: ["Ignored"] })).input
    ).not.toHaveProperty("actions")
    expect(
      validateDraft(draft({ kind: "approval", actions: [] })).input
    ).not.toHaveProperty("actions")
  })
})

describe("mergeAsks", () => {
  it("replaces changed asks by id and keeps the newest first", () => {
    const older = askFixture({
      id: "ask_old",
      createdAt: "2026-11-07T10:00:00.000Z",
    })
    const open = askFixture({
      id: "ask_mid",
      createdAt: "2026-11-07T11:00:00.000Z",
    })
    const answered = { ...open, status: "answered" as const, answer: "Yes" }
    const newest = askFixture({
      id: "ask_new",
      createdAt: "2026-11-07T12:00:00.000Z",
    })
    expect(
      mergeAsks([open, older], [newest, answered]).map((ask) => [
        ask.id,
        ask.status,
      ])
    ).toEqual([
      ["ask_new", "open"],
      ["ask_mid", "answered"],
      ["ask_old", "open"],
    ])
  })

  it("caps the list", () => {
    const many = Array.from({ length: 5 }, (_, index) =>
      askFixture({
        id: `ask_${index}`,
        createdAt: `2026-11-07T1${index}:00:00.000Z`,
      })
    )
    expect(mergeAsks([], many, 3).map((ask) => ask.id)).toEqual([
      "ask_4",
      "ask_3",
      "ask_2",
    ])
  })
})

describe("secondsLeft", () => {
  it("counts down from expiresAt while open, 0 once final or past", () => {
    const now = Date.parse("2026-11-07T14:00:00.000Z")
    expect(
      secondsLeft(
        { status: "open", expiresAt: "2026-11-07T14:01:30.000Z" },
        now
      )
    ).toBe(90)
    expect(
      secondsLeft(
        { status: "answered", expiresAt: "2026-11-07T14:01:30.000Z" },
        now
      )
    ).toBe(0)
    expect(
      secondsLeft(
        { status: "open", expiresAt: "2026-11-07T13:59:00.000Z" },
        now
      )
    ).toBe(0)
  })
})
