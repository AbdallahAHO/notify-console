import { screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { db } from "@/test/server"
import { renderApp } from "@/test/render"

describe("Destinations", () => {
  it("lists devices and webhooks with their tags and state", async () => {
    renderApp("/destinations")
    const device = (
      await screen.findByRole("link", { name: "Desk display" })
    ).closest("tr")!
    expect(within(device).getByText("online")).toBeInTheDocument()
    expect(within(device).getByText("desk")).toBeInTheDocument()
    expect(within(device).getByText("dst_Xq3v9KpL2mAa")).toBeInTheDocument()
    expect(
      within(
        screen.getByRole("link", { name: "n8n approvals" }).closest("tr")!
      ).getByText("push")
    ).toBeInTheDocument()
  })

  it("filters by kind", async () => {
    const { user } = renderApp("/destinations")
    await screen.findByRole("link", { name: "Desk display" })
    await user.click(screen.getByRole("button", { name: "Webhooks" }))
    expect(
      await screen.findByRole("link", { name: "n8n approvals" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "Desk display" })
    ).not.toBeInTheDocument()
  })

  it("renames and retags a destination", async () => {
    const { user } = renderApp("/destinations/dst_Xq3v9KpL2mAa")
    const name = await screen.findByLabelText("Name")
    await user.clear(name)
    await user.type(name, "Kitchen")
    const tags = screen.getByLabelText("Tags")
    await user.clear(tags)
    await user.type(tags, "Kitchen, home")
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(
      await screen.findByRole("heading", { name: "Kitchen" })
    ).toBeInTheDocument()
    expect(
      db.requests.find((request) => request.method === "PATCH")?.body
    ).toEqual({ name: "Kitchen", tags: ["kitchen", "home"] })
  })

  it("revokes only after confirmation", async () => {
    const { user } = renderApp("/destinations/dst_Xq3v9KpL2mAa")
    await user.click(await screen.findByRole("button", { name: "Revoke" }))
    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).getByText(/token stops working/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Keep" }))
    expect(db.requests.some((request) => request.method === "DELETE")).toBe(
      false
    )

    await user.click(screen.getByRole("button", { name: "Revoke" }))
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Revoke",
      })
    )
    expect(
      await screen.findByRole("heading", { name: "Destinations" })
    ).toBeInTheDocument()
    expect(
      db.destinations.find(
        (destination) => destination.id === "dst_Xq3v9KpL2mAa"
      )?.revokedAt
    ).not.toBeNull()
  })
})
