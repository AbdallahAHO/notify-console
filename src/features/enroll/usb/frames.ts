/** What arrives on the device's USB port: JSON lines, other text, and Improv Serial packets. */
export type Frame =
  | { kind: "line"; text: string; message: Record<string, unknown> | null }
  | { kind: "improv"; type: number; data: Uint8Array }

const IMPROV_HEADER = [0x49, 0x4d, 0x50, 0x52, 0x4f, 0x56] // "IMPROV"
const NEWLINE = 0x0a
const decoder = new TextDecoder()

const headerMatch = (buffer: Uint8Array, at: number) => {
  const available = Math.min(IMPROV_HEADER.length, buffer.length - at)
  for (let offset = 0; offset < available; offset++)
    if (buffer[at + offset] !== IMPROV_HEADER[offset]) return "no"
  return available === IMPROV_HEADER.length ? "full" : "partial"
}

const lineOf = (bytes: Uint8Array): Frame | null => {
  const text = decoder.decode(bytes).replace(/\r$/, "").trim()
  if (!text) return null
  if (!text.startsWith("{")) return { kind: "line", text, message: null }
  try {
    return { kind: "line", text, message: JSON.parse(text) }
  } catch {
    return { kind: "line", text, message: null }
  }
}

/** Splits received bytes into frames; Improv packets are only recognised at the start of a line. `rest` waits for more bytes. */
export const splitFrames = (buffer: Uint8Array) => {
  const frames: Frame[] = []
  let lineStart = 0
  let index = 0
  while (index < buffer.length) {
    if (index === lineStart) {
      const match = headerMatch(buffer, index)
      if (match === "partial") return { frames, rest: buffer.slice(index) }
      if (match === "full") {
        if (buffer.length - index < 9)
          return { frames, rest: buffer.slice(index) }
        const total = 9 + buffer[index + 8] + 1
        if (buffer.length - index < total)
          return { frames, rest: buffer.slice(index) }
        const packet = buffer.slice(index, index + total)
        const sum = packet
          .slice(0, -1)
          .reduce((acc, byte) => (acc + byte) & 0xff, 0)
        if (sum === packet[total - 1])
          frames.push({
            kind: "improv",
            type: packet[7],
            data: packet.slice(9, total - 1),
          })
        index += total
        if (buffer[index] === NEWLINE) index++
        lineStart = index
        continue
      }
    }
    if (buffer[index] === NEWLINE) {
      const frame = lineOf(buffer.slice(lineStart, index))
      if (frame) frames.push(frame)
      lineStart = index + 1
    }
    index++
  }
  return { frames, rest: buffer.slice(lineStart) }
}
