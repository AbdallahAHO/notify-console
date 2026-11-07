import { unwrap, type Destination, type NotifyClient } from "@/api/client"
import { LinkTimeoutError, sleep, type SerialLink } from "./link"

/**
 * How the board gets its token: `token` writes the API's token over USB; `pair` starts the device's own pairing,
 * reads its code over USB and approves it, so the token never passes through the browser at all.
 */
export type EnrollMode = "token" | "pair"

export const STEPS = {
  token: ["status", "wifi", "enroll", "link", "online"],
  pair: ["status", "wifi", "pair", "approve", "online"],
} as const satisfies Record<EnrollMode, readonly string[]>
export type EnrollStep = (typeof STEPS)[EnrollMode][number]
export type StepState = "pending" | "running" | "done" | "skipped" | "failed"

export type PairState =
  "idle" | "requesting" | "waiting" | "approved" | "expired" | "failed"

export type DeviceStatus = {
  wifi?: { state?: string; ssid?: string; ip?: string }
  notify?: { url?: string; ok?: boolean; pair?: PairState; code?: string }
  [key: string]: unknown
}

export type EnrollInput = {
  mode: EnrollMode
  name: string
  tags: string[]
  /** The ws(s)://…/api/devices/connect URL the device dials. */
  deviceUrl: string
  /** Pair mode: the host the device tells you to "Enter at" (this console's). */
  consoleHost?: string
  /** Join this network first; omit when the device is already online. */
  wifi?: { ssid: string; pass: string }
}

export type EnrollDeps = {
  link: SerialLink
  client: NotifyClient
  onStep: (step: EnrollStep, state: StepState, detail?: string) => void
  /** Pair mode: the code the device shows, as soon as it's read over USB. */
  onCode?: (code: string) => void
  /** How long to wait for a command's ack before carrying on without it. */
  ackTimeoutMs?: number
  wifiTimeoutMs?: number
  pairTimeoutMs?: number
  onlineTimeoutMs?: number
  pollMs?: number
}

/** The device's WebSocket URL for an API base: http → ws, https → wss. */
export const deviceSocketUrl = (apiUrl: string) =>
  `${apiUrl.replace(/\/+$/, "").replace(/^http/, "ws")}/api/devices/connect`

/** A device on the network can't dial these hosts on your computer. */
export const isLoopback = (url: string) => {
  try {
    return ["localhost", "127.0.0.1", "[::1]", "0.0.0.0"].includes(
      new URL(url).hostname
    )
  } catch {
    return false
  }
}

export const describeStatus = (status: DeviceStatus) => {
  const wifi =
    status.wifi?.state === "online"
      ? `Wi-Fi ${status.wifi.ssid ?? ""} ${status.wifi.ip ?? ""}`.trim()
      : `Wi-Fi ${status.wifi?.state ?? "unknown"}`
  const notify = status.notify?.url
    ? ` · notify ${status.notify.ok ? "connected" : "not connected"}`
    : ""
  const pair =
    status.notify?.pair === "waiting" && status.notify.code
      ? ` · pairing code ${status.notify.code}`
      : status.notify?.pair && status.notify.pair !== "idle"
        ? ` · pairing ${status.notify.pair}`
        : ""
  return `${wifi}${notify}${pair}`
}

const readStatus = async (link: SerialLink, timeoutMs?: number) => {
  const ack = await link.request({ cmd: "status" }, timeoutMs)
  return (ack.data ?? {}) as DeviceStatus
}

/** Sends a command whose ack may get lost: an explicit `ok:false` throws, silence is "unknown" and returns null. */
const command = async (
  link: SerialLink,
  line: { cmd: string } & Record<string, unknown>,
  refused: string,
  timeoutMs: number
) => {
  try {
    const ack = await link.request(line, timeoutMs)
    if (ack.ok === false)
      throw new Error(`${refused}${ack.error ? `: ${ack.error}` : ""}.`)
    return ack
  } catch (error) {
    if (error instanceof LinkTimeoutError) return null
    throw error
  }
}

/** Reads `status` until `check` returns a value (or throws); a missed status ack is just another try. */
const pollStatus = async <T>(
  link: SerialLink,
  check: (status: DeviceStatus) => T | undefined,
  {
    timeoutMs,
    pollMs,
    message,
  }: { timeoutMs: number; pollMs: number; message: string }
) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const status = await readStatus(link, 3000).catch((error) => {
      if (error instanceof LinkTimeoutError) return null
      throw error
    })
    const found = status ? check(status) : undefined
    if (found !== undefined) return found
    await sleep(pollMs)
  }
  throw new Error(message)
}

const joinWifi = async (
  link: SerialLink,
  wifi: { ssid: string; pass: string },
  {
    timeoutMs,
    pollMs,
    ackTimeoutMs,
  }: { timeoutMs: number; pollMs: number; ackTimeoutMs: number }
) => {
  if ((await link.probeImprov()) !== null) {
    const outcome = await link
      .improvWifi(wifi.ssid, wifi.pass, timeoutMs)
      .catch((error) => {
        if (error instanceof LinkTimeoutError) return null
        throw error
      })
    if (outcome && !outcome.ok) throw new Error(`Wi-Fi: ${outcome.error}`)
  } else {
    await command(
      link,
      { cmd: "wifi", ssid: wifi.ssid, pass: wifi.pass },
      "The device refused the Wi-Fi settings",
      ackTimeoutMs
    )
  }
  return pollStatus(
    link,
    (status) => (status.wifi?.state === "online" ? status : undefined),
    {
      timeoutMs,
      pollMs,
      message: `The device didn't join "${wifi.ssid}" within ${Math.round(timeoutMs / 1000)} s. Check the password and that it's a 2.4 GHz network.`,
    }
  )
}

/** Starts the device's pairing and reads its code over USB. */
const startPairing = async (
  link: SerialLink,
  input: EnrollInput,
  {
    timeoutMs,
    pollMs,
    ackTimeoutMs,
  }: { timeoutMs: number; pollMs: number; ackTimeoutMs: number }
) => {
  await command(
    link,
    {
      cmd: "notifylink",
      url: input.deviceUrl,
      pair: true,
      ...(input.consoleHost ? { console: input.consoleHost } : {}),
    },
    "The device refused to start pairing",
    ackTimeoutMs
  )
  return pollStatus(
    link,
    ({ notify }) => {
      if (notify?.pair === "expired" || notify?.pair === "failed")
        throw new Error(
          `Pairing ${notify.pair} on the device. Check that it can reach ${input.deviceUrl.replace(/^ws/, "http").replace(/\/api\/devices\/connect$/, "")}.`
        )
      return notify?.pair === "waiting" && notify.code ? notify.code : undefined
    },
    {
      timeoutMs,
      pollMs,
      message: `The device didn't show a pairing code within ${Math.round(timeoutMs / 1000)} s. Check that it can reach the API.`,
    }
  )
}

/** Polls the API until the device holds its connection; the device's own status is shown meanwhile. */
const waitOnline = async (
  link: SerialLink,
  client: NotifyClient,
  id: string,
  report: (detail: string) => void,
  {
    timeoutMs,
    pollMs,
    hint,
  }: { timeoutMs: number; pollMs: number; hint: string }
) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const destination = unwrap(
      await client.GET("/api/destinations/{id}", { params: { path: { id } } })
    )
    if (destination.online) return destination
    const status = await readStatus(link, 1500).catch(() => null)
    if (status) report(`device: ${describeStatus(status)}`)
    await sleep(pollMs)
  }
  throw new Error(
    `Enrolled as ${id}, but it hasn't connected within ${Math.round(timeoutMs / 1000)} s. ${hint}`
  )
}

/** Enrolls the device on the port (see EnrollMode). In token mode the token never leaves this function. */
export const enrollOverUsb = async (
  input: EnrollInput,
  deps: EnrollDeps
): Promise<Destination> => {
  const {
    link,
    client,
    onStep,
    onCode,
    ackTimeoutMs = 4000,
    wifiTimeoutMs = 30_000,
    pairTimeoutMs = 45_000,
    onlineTimeoutMs = 60_000,
    pollMs = 2000,
  } = deps
  let step: EnrollStep = "status"
  const run = async <T>(
    next: EnrollStep,
    work: () => Promise<T>,
    detail?: (value: T) => string
  ) => {
    step = next
    onStep(next, "running")
    const value = await work()
    onStep(next, "done", detail?.(value))
    return value
  }
  const online = (id: string, hint: string) =>
    run(
      "online",
      () =>
        waitOnline(
          link,
          client,
          id,
          (detail) => onStep("online", "running", detail),
          {
            timeoutMs: onlineTimeoutMs,
            pollMs,
            hint,
          }
        ),
      () => "connected"
    )

  try {
    const status = await run("status", () => readStatus(link), describeStatus)

    step = "wifi"
    if (input.wifi?.ssid) {
      await run(
        "wifi",
        () =>
          joinWifi(link, input.wifi!, {
            timeoutMs: wifiTimeoutMs,
            pollMs,
            ackTimeoutMs,
          }),
        (joined) => `online${joined.wifi?.ip ? ` at ${joined.wifi.ip}` : ""}`
      )
    } else if (status.wifi?.state === "online") {
      onStep("wifi", "skipped", `already on ${status.wifi.ssid ?? "Wi-Fi"}`)
    } else {
      throw new Error("The device isn't on Wi-Fi: enter a network to join.")
    }

    if (input.mode === "pair") {
      const code = await run(
        "pair",
        () =>
          startPairing(link, input, {
            timeoutMs: pairTimeoutMs,
            pollMs,
            ackTimeoutMs,
          }),
        (shown) => `code ${shown}`
      )
      onCode?.(code)
      const destination = await run(
        "approve",
        async () =>
          unwrap(
            await client.POST("/api/devices/pair/approve", {
              body: { code, name: input.name, tags: input.tags },
            })
          ),
        (approved) => approved.id
      )
      return await online(
        destination.id,
        "The device collects its token on its next poll; check it can reach the API."
      )
    }

    let token = ""
    const destination = await run(
      "enroll",
      async () => {
        const { token: minted, ...created } = unwrap(
          await client.POST("/api/destinations", {
            body: { kind: "device", name: input.name, tags: input.tags },
          })
        )
        token = minted ?? ""
        return created as Destination
      },
      (created) => created.id
    )

    let acked = true
    try {
      await run(
        "link",
        async () => {
          acked =
            (await command(
              link,
              { cmd: "notifylink", url: input.deviceUrl, token },
              "The device refused the link",
              ackTimeoutMs
            )) !== null
        },
        () =>
          acked
            ? "token stored on the device"
            : "sent; no ack over USB, watching for it to connect"
      )
    } catch (error) {
      // refused: the token dies with this function, so don't leave a destination nothing can connect as
      await client
        .DELETE("/api/destinations/{id}", {
          params: { path: { id: destination.id } },
        })
        .catch(() => undefined)
      throw error
    } finally {
      token = ""
    }

    return await online(
      destination.id,
      acked
        ? "Check that it can reach the device URL."
        : "The board never acknowledged the token: if it didn't store it, revoke this destination and enroll again."
    )
  } catch (error) {
    onStep(
      step,
      "failed",
      error instanceof Error ? error.message : String(error)
    )
    throw error
  }
}
