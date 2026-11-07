import { splitFrames, type Frame } from "./frames"
import {
  encodeRpc,
  IMPROV_ERROR,
  IMPROV_RPC,
  IMPROV_STATE,
  IMPROV_TYPE,
} from "./improv"

/** buddy-kit boards enumerate with Espressif's native USB vendor id. */
export const ESPRESSIF_VENDOR_ID = 0x303a
export const BAUD_RATE = 115200

export type PortLike = Pick<
  SerialPort,
  "open" | "close" | "readable" | "writable"
>

/** A device's `{"ack":"<cmd>",…}` line. */
export type Ack = Record<string, unknown> & { ack: string }

export class LinkTimeoutError extends Error {
  constructor(what: string, timeoutMs: number) {
    super(`No answer to ${what} within ${Math.round(timeoutMs / 1000)} s.`)
    this.name = "LinkTimeoutError"
  }
}

export type SerialLink = ReturnType<typeof createLink>

export const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

const encoder = new TextEncoder()

/** A line-JSON (and Improv) conversation over an open port: commands out, acks matched back, everything else ignored. */
export const createLink = (port: PortLike) => {
  const listeners = new Set<(frame: Frame) => void>()
  const reader = port.readable!.getReader()
  const writer = port.writable!.getWriter()
  let closed = false

  const readLoop = async () => {
    let pending = new Uint8Array()
    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done || !value) break
        const joined = new Uint8Array(pending.length + value.length)
        joined.set(pending)
        joined.set(value, pending.length)
        const { frames, rest } = splitFrames(joined)
        pending = rest
        frames.forEach((frame) =>
          listeners.forEach((listener) => listener(frame))
        )
      }
    } catch {
      // the port closed or the board was unplugged
    }
  }
  const reading = readLoop()

  const write = (bytes: Uint8Array) => writer.write(bytes)

  /** Resolves with the first frame `match` accepts, or rejects after `timeoutMs`. */
  const waitFor = <T>(
    what: string,
    match: (frame: Frame) => T | undefined,
    timeoutMs: number
  ) =>
    new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        listeners.delete(listener)
        reject(new LinkTimeoutError(what, timeoutMs))
      }, timeoutMs)
      const listener = (frame: Frame) => {
        const found = match(frame)
        if (found === undefined) return
        clearTimeout(timer)
        listeners.delete(listener)
        resolve(found)
      }
      listeners.add(listener)
    })

  /** Sends one command line and resolves with its ack. */
  const request = async (
    command: { cmd: string } & Record<string, unknown>,
    timeoutMs = 4000
  ) => {
    const answer = waitFor<Ack>(
      `"${command.cmd}"`,
      (frame) =>
        frame.kind === "line" && frame.message?.ack === command.cmd
          ? (frame.message as Ack)
          : undefined,
      timeoutMs
    )
    await write(encoder.encode(`${JSON.stringify(command)}\n`))
    return answer
  }

  /** The Improv state when the firmware speaks Improv Serial, else null (and the device's line buffer is flushed). */
  const probeImprov = async (timeoutMs = 1200) => {
    const answer = waitFor(
      "Improv",
      (frame) =>
        frame.kind === "improv" &&
        (frame.type === IMPROV_TYPE.state || frame.type === IMPROV_TYPE.result)
          ? frame
          : undefined,
      timeoutMs
    )
    await write(encodeRpc(IMPROV_RPC.getState))
    try {
      const frame = await answer
      return frame.type === IMPROV_TYPE.state
        ? frame.data[0]
        : IMPROV_STATE.ready
    } catch {
      await write(encoder.encode("\n"))
      return null
    }
  }

  /** Joins Wi-Fi over Improv; resolves once the firmware reports the result. */
  const improvWifi = async (ssid: string, pass: string, timeoutMs = 30_000) => {
    const outcome = waitFor(
      "Improv Wi-Fi",
      (frame) =>
        frame.kind !== "improv"
          ? undefined
          : frame.type === IMPROV_TYPE.result ||
              (frame.type === IMPROV_TYPE.state &&
                frame.data[0] === IMPROV_STATE.provisioned)
            ? { ok: true as const }
            : frame.type === IMPROV_TYPE.error && frame.data[0] !== 0
              ? {
                  ok: false as const,
                  error: IMPROV_ERROR[frame.data[0]] ?? "unknown error",
                }
              : undefined,
      timeoutMs
    )
    await write(encodeRpc(IMPROV_RPC.wifiSettings, [ssid, pass]))
    return outcome
  }

  const close = async () => {
    if (closed) return
    closed = true
    listeners.clear()
    await reader.cancel().catch(() => undefined)
    await reading
    reader.releaseLock()
    writer.releaseLock()
    await port.close().catch(() => undefined)
  }

  return { request, waitFor, probeImprov, improvWifi, close }
}

/** Opens a port at 115200 and waits out the reset that opening causes on some boards. */
export const openLink = async (port: PortLike, bootDelayMs = 2000) => {
  await port.open({ baudRate: BAUD_RATE })
  const link = createLink(port)
  await sleep(bootDelayMs)
  return link
}

/** Asks the browser for an Espressif USB port; null when the person cancels the picker. */
export const pickPort = async () => {
  try {
    return await navigator.serial!.requestPort({
      filters: [{ usbVendorId: ESPRESSIF_VENDOR_ID }],
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotFoundError")
      return null
    throw error
  }
}

export const webSerialSupported = () =>
  typeof navigator !== "undefined" && "serial" in navigator
