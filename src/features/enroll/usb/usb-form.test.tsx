import { screen } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { afterEach, describe, expect, it, vi } from "vitest"
import { API_URL } from "@/test/fixtures"
import { glanceDevice } from "@/test/fake-port"
import { db, server } from "@/test/server"
import { renderApp } from "@/test/render"

vi.mock("./link", async (original) => ({
  ...(await original<typeof import("./link")>()),
  sleep: () => new Promise((resolve) => setTimeout(resolve, 1)),
}))

const withSerial = (device: ReturnType<typeof glanceDevice>) => {
  const requestPort = vi.fn(async () =>
    Object.assign(new EventTarget(), device.port, {
      getInfo: () => ({ usbVendorId: 0x303a }),
    })
  )
  Object.defineProperty(navigator, "serial", {
    configurable: true,
    value: { requestPort },
  })
  return requestPort
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "serial")
})

describe("Enroll over USB", () => {
  it("says so in browsers without Web Serial and offers the pairing code", async () => {
    renderApp("/enroll?method=usb")
    expect(
      await screen.findByText("This browser can't open USB serial ports")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "pairing code" })
    ).toBeInTheDocument()
  })

  it("reads the board, enrolls it, and passes the token over USB without showing it", async () => {
    const device = glanceDevice()
    const requestPort = withSerial(device)
    server.use(
      http.get(`${API_URL}/api/destinations/:id`, ({ params }) =>
        HttpResponse.json(
          {
            ...db.destinations.find(
              (destination) => destination.id === params.id
            ),
            online: true,
          },
          { headers: { "content-type": "application/hal+json" } }
        )
      )
    )
    const { user, container } = renderApp("/enroll?method=usb")

    await user.click(await screen.findByRole("button", { name: "Choose port" }))
    expect(requestPort).toHaveBeenCalledWith({
      filters: [{ usbVendorId: 0x303a }],
    })
    expect(
      await screen.findByText(/Wi-Fi home 192.168.1.40/, {}, { timeout: 4000 })
    ).toBeInTheDocument()

    await user.type(screen.getByLabelText("Name"), "Desk Muma")
    await user.clear(screen.getByLabelText("Device URL"))
    await user.type(
      screen.getByLabelText("Device URL"),
      "ws://192.168.1.10:8787/api/devices/connect"
    )
    await user.click(screen.getByRole("button", { name: "Enroll device" }))

    expect(
      await screen.findByText("Desk Muma is online", {}, { timeout: 4000 })
    ).toBeInTheDocument()
    expect(device.lines()).toContainEqual({
      cmd: "notifylink",
      url: "ws://192.168.1.10:8787/api/devices/connect",
      token: "dtk_secret_device_token",
    })
    expect(container.innerHTML).not.toContain("dtk_")
  }, 10_000)

  it("pairs over USB: shows the code read from the board and approves it", async () => {
    const device = glanceDevice()
    withSerial(device)
    server.use(
      http.get(`${API_URL}/api/destinations/:id`, ({ params }) =>
        HttpResponse.json(
          {
            ...db.destinations.find(
              (destination) => destination.id === params.id
            ),
            online: true,
          },
          { headers: { "content-type": "application/hal+json" } }
        )
      )
    )
    const { user } = renderApp("/enroll?method=usb")
    await user.click(await screen.findByRole("button", { name: "Choose port" }))
    await screen.findByText(/Wi-Fi home 192.168.1.40/, {}, { timeout: 4000 })
    await user.click(screen.getByRole("button", { name: "Pairing code" }))
    await user.type(screen.getByLabelText("Name"), "Desk Muma")
    await user.click(screen.getByRole("button", { name: "Enroll device" }))

    expect(
      await screen.findByText("Desk Muma is online", {}, { timeout: 4000 })
    ).toBeInTheDocument()
    expect(device.lines()).toContainEqual(
      expect.objectContaining({
        cmd: "notifylink",
        pair: true,
        console: window.location.host,
      })
    )
    expect(screen.getByText("code K7M-4QX")).toBeInTheDocument()
    expect(
      db.requests.find(
        (request) => request.path === "/api/devices/pair/approve"
      )?.body
    ).toMatchObject({ code: "K7M-4QX", name: "Desk Muma" })
  }, 10_000)

  it("warns that a board can't reach localhost", async () => {
    withSerial(glanceDevice())
    const { user } = renderApp("/enroll?method=usb")
    const deviceUrl = await screen.findByLabelText("Device URL")
    expect(deviceUrl).toHaveValue("ws://notify.test/api/devices/connect")
    await user.clear(deviceUrl)
    await user.type(deviceUrl, "ws://localhost:8787/api/devices/connect")
    expect(screen.getByText(/can't reach localhost/)).toBeInTheDocument()
  })
})
