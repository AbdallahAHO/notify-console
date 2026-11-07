import type { PortLike } from "@/features/enroll/usb/link"

type Reply = Record<string, unknown> | Uint8Array | string

/** A SerialPort stand-in: `respond` plays the firmware, answering each JSON line or raw packet written to it. */
export const fakePort = (
  respond: (
    message: Record<string, unknown> | null,
    raw: Uint8Array
  ) => Reply[] = () => []
) => {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const written: Uint8Array[] = []
  let controller!: ReadableStreamDefaultController<Uint8Array>
  let pendingText = ""

  const emit = (reply: Reply) => {
    const bytes =
      reply instanceof Uint8Array
        ? reply
        : encoder.encode(
            typeof reply === "string" ? reply : `${JSON.stringify(reply)}\n`
          )
    queueMicrotask(() => controller.enqueue(bytes))
  }

  const port: PortLike & { opened: boolean; closed: boolean } = {
    opened: false,
    closed: false,
    readable: new ReadableStream<Uint8Array>({
      start: (ctrl) => void (controller = ctrl),
    }),
    writable: new WritableStream<Uint8Array>({
      write: (chunk) => {
        written.push(chunk)
        if (chunk[0] === 0x49) {
          respond(null, chunk).forEach(emit)
          return
        }
        pendingText += decoder.decode(chunk)
        let newline: number
        while ((newline = pendingText.indexOf("\n")) >= 0) {
          const line = pendingText.slice(0, newline)
          pendingText = pendingText.slice(newline + 1)
          if (line.trim())
            respond(JSON.parse(line), encoder.encode(line)).forEach(emit)
        }
      },
    }),
    open: async () => {
      port.opened = true
    },
    close: async () => {
      port.closed = true
    },
  }

  /** Every JSON line the console wrote. */
  const lines = () =>
    written
      .filter((chunk) => chunk[0] === 0x7b)
      .flatMap((chunk) => decoder.decode(chunk).split("\n").filter(Boolean))
      .map((line) => JSON.parse(line) as Record<string, unknown>)

  return { port, written, lines, emit }
}

type GlanceState = {
  wifi: { state: string; ssid?: string; ip?: string }
  notify?: { url?: string; ok?: boolean; pair?: string; code?: string }
  /** Answer notifylink with this `ok`; null drops the ack (as an unreliable USB ack would). */
  linkAck?: boolean | null
  /** Drop the wifi ack. */
  wifiAckLost?: boolean
  /** Pair mode: what the pairing ends in after "requesting". */
  pairOutcome?: "waiting" | "failed"
}

/** A glance board: answers status, wifi and notifylink the way the firmware does; no Improv. */
export const glanceDevice = (
  state: GlanceState = {
    wifi: { state: "online", ssid: "home", ip: "192.168.1.40" },
  }
) => {
  state.notify ??= { url: "", ok: false, pair: "idle" }
  const device = fakePort((message) => {
    if (!message) return []
    if (message.cmd === "status") {
      const reply = {
        ack: "status",
        ok: true,
        n: 0,
        data: { name: "glance", wifi: state.wifi, notify: { ...state.notify } },
      }
      if (state.notify!.pair === "requesting")
        state.notify =
          state.pairOutcome === "failed"
            ? { ...state.notify, pair: "failed" }
            : { ...state.notify, pair: "waiting", code: "K7M-4QX" }
      return [reply]
    }
    if (message.cmd === "wifi") {
      state.wifi = {
        state: "online",
        ssid: String(message.ssid),
        ip: "192.168.1.41",
      }
      return state.wifiAckLost ? [] : [{ ack: "wifi", ok: true, n: 0 }]
    }
    if (message.cmd === "notifylink") {
      if (message.pair)
        state.notify = {
          url: String(message.url),
          ok: false,
          pair: "requesting",
        }
      const ok = state.linkAck === undefined ? true : state.linkAck
      return ok === null ? [] : [{ ack: "notifylink", ok, n: 0 }]
    }
    return []
  })
  return { ...device, state }
}
