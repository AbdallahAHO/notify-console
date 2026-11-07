import { screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { db } from "@/test/server"
import { renderApp } from "@/test/render"

describe("Asks", () => {
  it("lists asks with their per-destination delivery states", async () => {
    renderApp("/asks")
    const row = (await screen.findByText("Deploy reelandsheet?")).closest("li")!
    expect(within(row).getByText("open")).toBeInTheDocument()
    expect(within(row).getByText("seen")).toBeInTheDocument()
    expect(within(row).getByText(/left/)).toBeInTheDocument()
  })

  it("counts the title against the 40-character limit and blocks sending past it", async () => {
    const { user } = renderApp("/asks")
    await user.type(await screen.findByLabelText("Title"), "x".repeat(41))
    expect(screen.getByText("41/40")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Send" }))
    expect(await screen.findByText("At most 40 characters")).toBeInTheDocument()
    expect(db.requests.some((request) => request.method === "POST")).toBe(false)
  })

  it("sends an approval to a tag and shows it in the list", async () => {
    const { user } = renderApp("/asks")
    await user.click(await screen.findByRole("button", { name: "approval" }))
    await user.click(await screen.findByRole("button", { name: "tag:desk" }))
    await user.type(screen.getByLabelText("Title"), "Ship it?")
    await user.click(screen.getByRole("button", { name: "Send" }))

    expect(await screen.findByText("Ship it?")).toBeInTheDocument()
    expect(
      db.requests.find((request) => request.method === "POST")?.body
    ).toEqual({
      kind: "approval",
      title: "Ship it?",
      ttl: 600,
      to: ["tag:desk"],
      actions: ["Approve", "Deny"],
    })
  })

  it("cancels an open ask", async () => {
    const { user } = renderApp("/asks")
    const row = (await screen.findByText("Deploy reelandsheet?")).closest("li")!
    await user.click(within(row).getByRole("button", { name: "Cancel" }))
    expect(await within(row).findByText("cancelled")).toBeInTheDocument()
    expect(within(row).getByText("retracted")).toBeInTheDocument()
  })
})
