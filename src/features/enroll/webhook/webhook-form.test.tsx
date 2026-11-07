import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { db } from "@/test/server"
import { renderApp } from "@/test/render"

describe("Enroll a webhook", () => {
  it("shows the signing secret once, with how to verify it, then forgets it", async () => {
    const { user, queryClient } = renderApp("/enroll?method=webhook")
    await user.type(await screen.findByLabelText("Name"), "n8n deploys")
    await user.type(screen.getByLabelText("Tags"), "n8n")
    await user.type(
      screen.getByLabelText("URL"),
      "https://n8n.example.com/webhook/deploys"
    )
    await user.click(screen.getByRole("button", { name: "Enroll webhook" }))

    expect(
      await screen.findByText("Copy the signing secret now")
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Signing secret")).toHaveValue(
      "whsec_secret_webhook_key"
    )
    expect(screen.getByText(/timingSafeEqual/)).toBeInTheDocument()
    expect(
      db.requests.find((request) => request.method === "POST")?.body
    ).toEqual({
      kind: "webhook",
      name: "n8n deploys",
      tags: ["n8n"],
      url: "https://n8n.example.com/webhook/deploys",
    })
    expect(
      JSON.stringify(
        queryClient
          .getQueryCache()
          .getAll()
          .map((query) => query.state.data)
      )
    ).not.toContain("whsec_")

    await user.click(screen.getByRole("button", { name: "I've stored it" }))
    expect(screen.queryByLabelText("Signing secret")).not.toBeInTheDocument()
    expect(
      screen.queryByDisplayValue("whsec_secret_webhook_key")
    ).not.toBeInTheDocument()
  })
})
