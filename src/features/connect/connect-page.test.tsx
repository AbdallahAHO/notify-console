import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { API_KEY, API_URL } from "@/test/fixtures"
import { renderApp } from "@/test/render"
import { getSettings } from "./settings"

describe("Connect", () => {
  it("points a fresh console to Connect", async () => {
    const { user } = renderApp("/asks", { connected: false })
    expect(await screen.findByText("Not connected")).toBeInTheDocument()
    await user.click(screen.getAllByRole("link", { name: "Connect" }).at(-1)!)
    expect(await screen.findByLabelText("API key")).toBeInTheDocument()
  })

  it("checks health and the key before saving them", async () => {
    const { user } = renderApp("/connect", { connected: false })
    const url = await screen.findByLabelText("API URL")
    await user.clear(url)
    await user.type(url, `${API_URL}/`)
    await user.type(screen.getByLabelText("API key"), API_KEY)
    await user.click(screen.getByRole("button", { name: "Check and save" }))
    expect(await screen.findByText("Connected")).toBeInTheDocument()
    expect(screen.getByText(/Notify 0.1.0, key accepted/)).toBeInTheDocument()
    expect(getSettings()).toEqual({ apiUrl: API_URL, apiKey: API_KEY })
  })

  it("doesn't save a key the API rejects", async () => {
    const { user } = renderApp("/connect", { connected: false })
    const url = await screen.findByLabelText("API URL")
    await user.clear(url)
    await user.type(url, API_URL)
    await user.type(screen.getByLabelText("API key"), "ntf_wrong")
    await user.click(screen.getByRole("button", { name: "Check and save" }))
    expect(await screen.findByText("Not saved")).toBeInTheDocument()
    expect(screen.getByText(/Send Authorization: Bearer/)).toBeInTheDocument()
    expect(getSettings().apiKey).toBe("")
  })
})
