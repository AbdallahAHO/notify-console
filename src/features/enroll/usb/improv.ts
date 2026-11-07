/** Improv Serial v1 (improv-wifi.com/serial): the packets the console sends and reads. */
export const IMPROV_TYPE = {
  state: 0x01,
  error: 0x02,
  rpc: 0x03,
  result: 0x04,
} as const
export const IMPROV_RPC = {
  wifiSettings: 0x01,
  getState: 0x02,
  getInfo: 0x03,
} as const
export const IMPROV_STATE = {
  ready: 0x02,
  provisioning: 0x03,
  provisioned: 0x04,
} as const
export const IMPROV_ERROR: Record<number, string> = {
  0x01: "invalid RPC",
  0x02: "unknown RPC",
  0x03: "unable to connect to that network",
  0xff: "unknown error",
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const HEADER = encoder.encode("IMPROV")

/** A framed packet: header, version 1, type, length, data, checksum (sum of all prior bytes mod 256). */
export const encodePacket = (type: number, data: Uint8Array) => {
  const body = new Uint8Array([...HEADER, 1, type, data.length, ...data])
  const checksum = body.reduce((sum, byte) => (sum + byte) & 0xff, 0)
  return new Uint8Array([...body, checksum])
}

/** An RPC packet: command, then length-prefixed strings. */
export const encodeRpc = (command: number, strings: string[] = []) => {
  const payload = strings.flatMap((text) => {
    const bytes = encoder.encode(text)
    return [bytes.length, ...bytes]
  })
  return encodePacket(
    IMPROV_TYPE.rpc,
    new Uint8Array([command, payload.length, ...payload])
  )
}

/** The strings of an RPC result packet's data. */
export const decodeResultStrings = (data: Uint8Array) => {
  const strings: string[] = []
  let index = 2
  while (index < data.length) {
    const length = data[index]
    strings.push(decoder.decode(data.slice(index + 1, index + 1 + length)))
    index += 1 + length
  }
  return strings
}
