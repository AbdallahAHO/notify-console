import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import type { Ask, Destination } from "@/api/client"
import {
  API_KEY,
  API_URL,
  askFixture,
  deviceFixture,
  webhookFixture,
} from "./fixtures"

const HAL = { headers: { "content-type": "application/hal+json" } }
const problem = (status: number, code: string, detail: string) =>
  HttpResponse.json(
    { type: `${API_URL}/problems/${code}`, code, title: code, status, detail },
    { status, headers: { "content-type": "application/problem+json" } }
  )

/** An in-memory notify the handlers read and write; tests seed and inspect it. */
export const db = {
  destinations: [] as Destination[],
  asks: [] as Ask[],
  requests: [] as { method: string; path: string; body: unknown }[],
  reset() {
    this.destinations = [deviceFixture(), webhookFixture()]
    this.asks = [askFixture()]
    this.requests = []
  },
}

const authorized = (request: Request) =>
  request.headers.get("authorization") === `Bearer ${API_KEY}`
const record = async (request: Request) => {
  const body =
    request.method === "GET" || request.method === "DELETE"
      ? undefined
      : await request
          .clone()
          .json()
          .catch(() => undefined)
  db.requests.push({
    method: request.method,
    path: new URL(request.url).pathname,
    body,
  })
}

let sequence = 0
const nextId = (prefix: string) =>
  `${prefix}_${String(++sequence).padStart(12, "0")}`

export const handlers = [
  http.get(`${API_URL}/api/health`, () =>
    HttpResponse.json({ status: "ok", version: "0.1.0" })
  ),
  http.all(`${API_URL}/api*`, async ({ request }) => {
    await record(request)
    if (!authorized(request))
      return problem(401, "unauthorized", "Send Authorization: Bearer <key>.")
    return undefined
  }),
  http.get(`${API_URL}/api`, () =>
    HttpResponse.json({ name: "Notify", version: "0.1.0", _links: {} }, HAL)
  ),
  http.get(`${API_URL}/api/destinations`, ({ request }) => {
    const query = new URL(request.url).searchParams
    const list = db.destinations.filter(
      (destination) =>
        (query.get("includeRevoked") === "true" || !destination.revokedAt) &&
        (!query.get("kind") || destination.kind === query.get("kind"))
    )
    return HttpResponse.json(
      { count: list.length, _links: {}, _embedded: { destinations: list } },
      HAL
    )
  }),
  http.get(`${API_URL}/api/destinations/:id`, ({ params }) => {
    const found = db.destinations.find(
      (destination) => destination.id === params.id
    )
    return found
      ? HttpResponse.json(found, HAL)
      : problem(404, "not_found", `No destination ${params.id}.`)
  }),
  http.post(`${API_URL}/api/destinations`, async ({ request }) => {
    const input = (await request.json()) as {
      kind: "device" | "webhook"
      name: string
      tags?: string[]
      url?: string
    }
    const created = deviceFixture({
      id: nextId("dst"),
      kind: input.kind,
      name: input.name,
      tags: input.tags ?? [],
      url: input.url ?? null,
      online: input.kind === "device" ? false : null,
      lastSeenAt: null,
    })
    db.destinations.unshift(created)
    return HttpResponse.json(
      {
        ...created,
        ...(input.kind === "device"
          ? { token: "dtk_secret_device_token" }
          : { secret: "whsec_secret_webhook_key" }),
      },
      { status: 201, ...HAL }
    )
  }),
  http.patch(`${API_URL}/api/destinations/:id`, async ({ params, request }) => {
    const patch = (await request.json()) as Partial<Destination>
    const index = db.destinations.findIndex(
      (destination) => destination.id === params.id
    )
    if (index < 0)
      return problem(404, "not_found", `No destination ${params.id}.`)
    db.destinations[index] = { ...db.destinations[index], ...patch }
    return HttpResponse.json(db.destinations[index], HAL)
  }),
  http.delete(`${API_URL}/api/destinations/:id`, ({ params }) => {
    const index = db.destinations.findIndex(
      (destination) => destination.id === params.id
    )
    if (index < 0)
      return problem(404, "not_found", `No destination ${params.id}.`)
    db.destinations[index] = {
      ...db.destinations[index],
      revokedAt: "2026-11-07T15:00:00.000Z",
      online: false,
    }
    return new HttpResponse(null, { status: 204 })
  }),
  http.post(`${API_URL}/api/devices/pair/approve`, async ({ request }) => {
    const input = (await request.json()) as {
      code: string
      name: string
      tags?: string[]
    }
    if (input.code.replace("-", "").toUpperCase() !== "K7M4QX")
      return problem(404, "not_found", "No pending pairing with that code.")
    const created = deviceFixture({
      id: nextId("dst"),
      name: input.name,
      tags: input.tags ?? [],
      online: false,
      lastSeenAt: null,
    })
    db.destinations.unshift(created)
    return HttpResponse.json(created, { status: 201, ...HAL })
  }),
  http.get(`${API_URL}/api/asks`, ({ request }) => {
    const since = new URL(request.url).searchParams.get("updatedSince")
    const asks = since
      ? db.asks.filter((ask) => (ask.finishedAt ?? ask.createdAt) > since)
      : db.asks
    return HttpResponse.json(
      {
        count: asks.length,
        asOf: new Date().toISOString(),
        _links: {},
        _embedded: { asks },
      },
      HAL
    )
  }),
  http.post(`${API_URL}/api/asks`, async ({ request }) => {
    const input = (await request.json()) as {
      to: string[]
      kind: Ask["kind"]
      title: string
      body?: string
      actions?: string[]
      ttl: number
    }
    const targets = db.destinations.filter(
      (destination) =>
        input.to.includes(destination.id) ||
        destination.tags.some((tag) => input.to.includes(`tag:${tag}`))
    )
    if (!targets.length)
      return problem(
        422,
        "unprocessable",
        "`to` matches no active destination."
      )
    const ask = askFixture({
      id: nextId("ask"),
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      actions:
        input.actions ?? (input.kind === "approval" ? ["Approve", "Deny"] : []),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + input.ttl * 1000).toISOString(),
      deliveries: targets.map((target) => ({
        destinationId: target.id,
        name: target.name,
        kind: target.kind,
        state: "queued",
        updatedAt: new Date().toISOString(),
      })),
    })
    db.asks.unshift(ask)
    return HttpResponse.json(ask, { status: 201, ...HAL })
  }),
  http.post(`${API_URL}/api/asks/:id/cancel`, ({ params }) => {
    const index = db.asks.findIndex((ask) => ask.id === params.id)
    if (index < 0) return problem(404, "not_found", `No ask ${params.id}.`)
    if (db.asks[index].status !== "open")
      return problem(409, "conflict", "Already final.")
    db.asks[index] = {
      ...db.asks[index],
      status: "cancelled",
      finishedAt: new Date().toISOString(),
      deliveries: db.asks[index].deliveries.map((delivery) => ({
        ...delivery,
        state: "retracted",
      })),
    }
    return HttpResponse.json(db.asks[index], HAL)
  }),
]

export const server = setupServer(...handlers)
