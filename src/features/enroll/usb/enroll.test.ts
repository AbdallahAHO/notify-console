import { describe, expect, it } from "vitest"
import { notifyClient } from "@/api/client"
import { API_KEY, API_URL } from "@/test/fixtures"
import { glanceDevice } from "@/test/fake-port"
import { http, HttpResponse } from "msw"
import { db, server } from "@/test/server"
import {
  deviceSocketUrl,
  type EnrollMode,
  enrollOverUsb,
  isLoopback,
  type EnrollStep,
  type StepState,
} from "./enroll"
import { createLink } from "./link"

const client = () => notifyClient({ apiUrl: API_URL, apiKey: API_KEY })
const DEVICE_URL = "wss://notify.example.com/api/devices/connect"

/** The board dials in as soon as it has its token: every read of a destination says online. */
const comesOnline = () =>
  server.use(
    http.get(`${API_URL}/api/destinations/:id`, ({ params }) => {
      const found = db.destinations.find(
        (destination) => destination.id === params.id
      )
      return HttpResponse.json(
        { ...found, online: true },
        { headers: { "content-type": "application/hal+json" } }
      )
    })
  )

const run = async (
  device: ReturnType<typeof glanceDevice>,
  wifi?: { ssid: string; pass: string },
  mode: EnrollMode = "token"
) => {
  const steps: [EnrollStep, StepState, string?][] = []
  const codes: string[] = []
  comesOnline()
  const result = await enrollOverUsb(
    {
      mode,
      name: "Desk Muma",
      tags: ["desk"],
      deviceUrl: DEVICE_URL,
      consoleHost: "console.example.com",
      wifi,
    },
    {
      link: createLink(device.port),
      client: client(),
      onStep: (...step) => steps.push(step),
      onCode: (code) => codes.push(code),
      pollMs: 5,
      ackTimeoutMs: 50,
      wifiTimeoutMs: 500,
      pairTimeoutMs: 500,
      onlineTimeoutMs: 500,
    }
  )
  return { result, steps, codes }
}

describe("enrollOverUsb", () => {
  it("creates the device, hands its token to the board over USB, and waits for it online", async () => {
    const device = glanceDevice()
    const { result, steps } = await run(device)

    expect(
      db.requests.find((request) => request.method === "POST")?.body
    ).toEqual({ kind: "device", name: "Desk Muma", tags: ["desk"] })
    expect(device.lines()).toContainEqual({
      cmd: "notifylink",
      url: DEVICE_URL,
      token: "dtk_secret_device_token",
    })
    expect(result).toMatchObject({ name: "Desk Muma", online: true })
    expect(JSON.stringify(result)).not.toContain("dtk_")
    expect(JSON.stringify(steps)).not.toContain("dtk_")
    expect(
      steps
        .filter(([, state]) => state !== "running")
        .map(([step, state]) => `${step}:${state}`)
    ).toEqual([
      "status:done",
      "wifi:skipped",
      "enroll:done",
      "link:done",
      "online:done",
    ])
  })

  it("joins Wi-Fi over line-JSON when the firmware has no Improv", async () => {
    const device = glanceDevice({ wifi: { state: "idle" } })
    const { steps } = await run(device, { ssid: "home", pass: "pw" })
    expect(device.lines()).toContainEqual({
      cmd: "wifi",
      ssid: "home",
      pass: "pw",
    })
    expect(steps).toContainEqual(["wifi", "done", "online at 192.168.1.41"])
  })

  it("stops before creating anything when the device is offline and no network was given", async () => {
    const device = glanceDevice({ wifi: { state: "idle" } })
    await expect(run(device)).rejects.toThrow(/isn't on Wi-Fi/)
    expect(db.requests.some((request) => request.method === "POST")).toBe(false)
  })

  it("revokes the new destination when the board refuses the link, so no orphan is left", async () => {
    const device = glanceDevice({
      wifi: { state: "online", ssid: "home" },
      linkAck: false,
    })
    await expect(run(device)).rejects.toThrow(/refused the link/)
    expect(db.requests.at(-1)).toMatchObject({ method: "DELETE" })
    expect(db.destinations[0].revokedAt).not.toBeNull()
  })
})

describe("enrollOverUsb without reliable acks", () => {
  it("joins Wi-Fi when the wifi ack never arrives, by watching status", async () => {
    const device = glanceDevice({ wifi: { state: "idle" }, wifiAckLost: true })
    const { steps } = await run(device, { ssid: "home", pass: "pw" })
    expect(steps).toContainEqual(["wifi", "done", "online at 192.168.1.41"])
  })

  it("keeps the destination and waits for it online when the notifylink ack is lost", async () => {
    const device = glanceDevice({
      wifi: { state: "online", ssid: "home" },
      linkAck: null,
    })
    const { result, steps } = await run(device)
    expect(result.online).toBe(true)
    expect(steps).toContainEqual([
      "link",
      "done",
      "sent; no ack over USB, watching for it to connect",
    ])
    expect(db.requests.some((request) => request.method === "DELETE")).toBe(
      false
    )
  })
})

describe("enrollOverUsb in pair mode", () => {
  it("starts pairing on the board, reads its code over USB and approves it: no token in the browser", async () => {
    const device = glanceDevice()
    const { result, steps, codes } = await run(device, undefined, "pair")

    expect(device.lines()).toContainEqual({
      cmd: "notifylink",
      url: DEVICE_URL,
      pair: true,
      console: "console.example.com",
    })
    expect(codes).toEqual(["K7M-4QX"])
    expect(
      db.requests.find(
        (request) => request.path === "/api/devices/pair/approve"
      )?.body
    ).toEqual({ code: "K7M-4QX", name: "Desk Muma", tags: ["desk"] })
    expect(
      db.requests.some(
        (request) =>
          request.method === "POST" && request.path === "/api/destinations"
      )
    ).toBe(false)
    expect(result).toMatchObject({ name: "Desk Muma", online: true })
    expect(
      steps
        .filter(([, state]) => state !== "running")
        .map(([step, state]) => `${step}:${state}`)
    ).toEqual([
      "status:done",
      "wifi:skipped",
      "pair:done",
      "approve:done",
      "online:done",
    ])
  })

  it("stops when the board's pairing fails", async () => {
    const device = glanceDevice({
      wifi: { state: "online", ssid: "home" },
      pairOutcome: "failed",
    })
    await expect(run(device, undefined, "pair")).rejects.toThrow(
      /Pairing failed/
    )
    expect(
      db.requests.some(
        (request) => request.path === "/api/devices/pair/approve"
      )
    ).toBe(false)
  })
})

describe("device URLs", () => {
  it("turns the API base into the device socket URL", () => {
    expect(deviceSocketUrl("https://notify.example.com/")).toBe(
      "wss://notify.example.com/api/devices/connect"
    )
    expect(deviceSocketUrl("http://192.168.1.10:8787")).toBe(
      "ws://192.168.1.10:8787/api/devices/connect"
    )
  })

  it("flags hosts a board can't reach", () => {
    expect(isLoopback("ws://localhost:8787/api/devices/connect")).toBe(true)
    expect(isLoopback("ws://192.168.1.10:8787/api/devices/connect")).toBe(false)
  })
})
