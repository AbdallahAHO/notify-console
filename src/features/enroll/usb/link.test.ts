import { describe, expect, it } from "vitest"
import { fakePort, glanceDevice } from "@/test/fake-port"
import { encodePacket, IMPROV_STATE, IMPROV_TYPE } from "./improv"
import { createLink, LinkTimeoutError, openLink } from "./link"

describe("serial link", () => {
  it("opens at 115200 and matches each command to its ack, ignoring unrelated lines", async () => {
    const device = fakePort((message) =>
      message?.cmd === "status"
        ? [
            '{"ack":"notify","id":"ask_1","state":"delivered"}\n',
            "garbage\n",
            { ack: "status", ok: true, data: { wifi: { state: "online" } } },
          ]
        : []
    )
    const link = await openLink(device.port, 0)
    expect(device.port.opened).toBe(true)
    await expect(link.request({ cmd: "status" })).resolves.toMatchObject({
      ack: "status",
      data: { wifi: { state: "online" } },
    })
    expect(device.lines()).toEqual([{ cmd: "status" }])
    await link.close()
    expect(device.port.closed).toBe(true)
  })

  it("times out when the firmware never acks", async () => {
    const link = createLink(fakePort().port)
    await expect(
      link.request({ cmd: "species", idx: 1 }, 20)
    ).rejects.toBeInstanceOf(LinkTimeoutError)
    await link.close()
  })

  it("reports no Improv and flushes the device's line buffer when the firmware stays quiet", async () => {
    const device = glanceDevice()
    const link = createLink(device.port)
    expect(await link.probeImprov(20)).toBeNull()
    expect(new TextDecoder().decode(device.written.at(-1))).toBe("\n")
    await link.close()
  })

  it("speaks Improv when the firmware answers it", async () => {
    const device = fakePort((message, raw) => {
      if (message || raw[8 + 1] === undefined) return []
      const command = raw[9]
      if (command === 0x02)
        return [
          encodePacket(IMPROV_TYPE.state, new Uint8Array([IMPROV_STATE.ready])),
          "\n",
        ]
      return [
        encodePacket(
          IMPROV_TYPE.state,
          new Uint8Array([IMPROV_STATE.provisioning])
        ),
        "\n",
        encodePacket(IMPROV_TYPE.result, new Uint8Array([1, 0])),
        "\n",
      ]
    })
    const link = createLink(device.port)
    expect(await link.probeImprov(200)).toBe(IMPROV_STATE.ready)
    await expect(link.improvWifi("home", "pw", 200)).resolves.toEqual({
      ok: true,
    })
    await link.close()
  })

  it("surfaces an Improv connect error", async () => {
    const device = fakePort((message) =>
      message
        ? []
        : [encodePacket(IMPROV_TYPE.error, new Uint8Array([0x03])), "\n"]
    )
    const link = createLink(device.port)
    await expect(link.improvWifi("home", "wrong", 200)).resolves.toEqual({
      ok: false,
      error: "unable to connect to that network",
    })
    await link.close()
  })
})
