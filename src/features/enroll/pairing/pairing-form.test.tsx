import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { db } from "@/test/server"
import { renderApp } from "@/test/render"

describe("Enroll by pairing code", () => {
  it("approves a loosely typed code and waits for the device", async () => {
    const { user } = renderApp("/enroll?method=code")
    await user.type(
      await screen.findByLabelText("Code on the device"),
      "k7m 4qx"
    )
    await user.type(screen.getByLabelText("Name"), "Desk Muma")
    await user.type(screen.getByLabelText("Tags"), "desk")
    await user.click(screen.getByRole("button", { name: "Approve" }))

    expect(
      await screen.findByText(/Waiting for Desk Muma to connect/)
    ).toBeInTheDocument()
    expect(
      db.requests.find(
        (request) => request.path === "/api/devices/pair/approve"
      )?.body
    ).toEqual({ code: "K7M-4QX", name: "Desk Muma", tags: ["desk"] })
  })

  it("explains an unknown or expired code", async () => {
    const { user } = renderApp("/enroll?method=code")
    await user.type(
      await screen.findByLabelText("Code on the device"),
      "ABC-DEF"
    )
    await user.type(screen.getByLabelText("Name"), "Desk Muma")
    await user.click(screen.getByRole("button", { name: "Approve" }))
    expect(await screen.findByText(/may have expired/)).toBeInTheDocument()
  })

  it("won't send a code that can't exist", async () => {
    const { user } = renderApp("/enroll?method=code")
    await user.type(
      await screen.findByLabelText("Code on the device"),
      "IOL-0U1"
    )
    await user.type(screen.getByLabelText("Name"), "Desk Muma")
    expect(screen.getByText(/without I, L, O, U/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled()
  })
})
