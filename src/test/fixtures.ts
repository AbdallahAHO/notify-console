import type { Ask, Destination } from "@/api/client"

/** Fixtures shaped by the notify OpenAPI examples (src/api/openapi.json). */
export const API_URL = "http://notify.test"
export const API_KEY = "ntf_test_key"

const links = (path: string) => ({ self: { href: `${API_URL}${path}` } })

export const deviceFixture = (
  overrides: Partial<Destination> = {}
): Destination => ({
  id: "dst_Xq3v9KpL2mAa",
  kind: "device",
  name: "Desk display",
  tags: ["desk", "home"],
  url: null,
  online: true,
  lastSeenAt: "2026-11-07T14:02:11.000Z",
  lastStatus: null,
  revokedAt: null,
  createdAt: "2026-11-07T13:58:00.000Z",
  _links: links("/api/destinations/dst_Xq3v9KpL2mAa"),
  ...overrides,
})

export const webhookFixture = (
  overrides: Partial<Destination> = {}
): Destination => ({
  ...deviceFixture(),
  id: "dst_Wh00kN8nAppr",
  kind: "webhook",
  name: "n8n approvals",
  tags: ["n8n"],
  url: "https://n8n.example.com/webhook/notify",
  online: null,
  lastSeenAt: null,
  _links: links("/api/destinations/dst_Wh00kN8nAppr"),
  ...overrides,
})

export const askFixture = (overrides: Partial<Ask> = {}): Ask => ({
  id: "ask_3fJ9qLm2Xw0a",
  kind: "question",
  title: "Deploy reelandsheet?",
  body: "3 commits behind",
  actions: ["Yes", "No"],
  status: "open",
  answer: null,
  answeredBy: null,
  sender: "claude-code",
  secondsLeft: 540,
  createdAt: "2026-11-07T14:02:10.000Z",
  expiresAt: "2099-11-07T14:12:10.000Z",
  finishedAt: null,
  callbackUrl: null,
  deliveries: [
    {
      destinationId: "dst_Xq3v9KpL2mAa",
      name: "Desk display",
      kind: "device",
      state: "seen",
      updatedAt: "2026-11-07T14:02:15.000Z",
    },
  ],
  _links: links("/api/asks/ask_3fJ9qLm2Xw0a"),
  ...overrides,
})
