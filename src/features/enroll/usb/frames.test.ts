import { describe, expect, it } from "vitest"
import { splitFrames } from "./frames"
import {
  decodeResultStrings,
  encodePacket,
  encodeRpc,
  IMPROV_RPC,
  IMPROV_TYPE,
} from "./improv"

const bytes = (text: string) => new TextEncoder().encode(text)
const join = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  parts.reduce((at, part) => (out.set(part, at), at + part.length), 0)
  return out
}

describe("splitFrames", () => {
  it("parses JSON lines and keeps other text as plain lines", () => {
    const { frames, rest } = splitFrames(
      bytes('{"ack":"status","ok":true}\r\nI (123) wifi: started\n{"partial":')
    )
    expect(frames).toEqual([
      {
        kind: "line",
        text: '{"ack":"status","ok":true}',
        message: { ack: "status", ok: true },
      },
      { kind: "line", text: "I (123) wifi: started", message: null },
    ])
    expect(new TextDecoder().decode(rest)).toBe('{"partial":')
  })

  it("reads an Improv packet at the start of a line, even with a newline byte inside it", () => {
    const packet = encodePacket(IMPROV_TYPE.state, new Uint8Array([0x0a]))
    const { frames, rest } = splitFrames(
      join(packet, bytes("\n"), bytes('{"ack":"x"}\n'))
    )
    expect(frames[0]).toEqual({
      kind: "improv",
      type: IMPROV_TYPE.state,
      data: new Uint8Array([0x0a]),
    })
    expect(frames[1]).toMatchObject({ kind: "line", message: { ack: "x" } })
    expect(rest.length).toBe(0)
  })

  it("waits for the rest of a split packet, and drops one with a bad checksum", () => {
    const packet = encodePacket(IMPROV_TYPE.state, new Uint8Array([0x04]))
    expect(splitFrames(packet.slice(0, 4))).toEqual({
      frames: [],
      rest: packet.slice(0, 4),
    })
    expect(splitFrames(packet.slice(0, 10)).rest.length).toBe(10)
    const corrupt = packet.slice()
    corrupt[corrupt.length - 1] ^= 0xff
    expect(splitFrames(corrupt).frames).toEqual([])
  })
})

describe("Improv packets", () => {
  it("frames an RPC with length-prefixed strings and a checksum", () => {
    const packet = encodeRpc(IMPROV_RPC.wifiSettings, ["home", "pw"])
    expect(new TextDecoder().decode(packet.slice(0, 6))).toBe("IMPROV")
    expect([...packet.slice(6, 9)]).toEqual([1, IMPROV_TYPE.rpc, 10])
    expect([...packet.slice(9, 19)]).toEqual([
      IMPROV_RPC.wifiSettings,
      8,
      4,
      ...bytes("home"),
      2,
      ...bytes("pw"),
    ])
    expect(packet[19]).toBe(
      packet.slice(0, 19).reduce((sum, byte) => (sum + byte) & 0xff, 0)
    )
  })

  it("decodes a result's strings", () => {
    expect(
      decodeResultStrings(new Uint8Array([1, 9, 8, ...bytes("http://x")]))
    ).toEqual(["http://x"])
  })
})
