import { describe, expect, it } from "vitest"
import { defaultApiUrl, resolveSettings } from "./settings"

describe("defaultApiUrl", () => {
  it("prefers the runtime /config.json over the build env", () => {
    expect(
      defaultApiUrl(
        { apiUrl: "https://notify.example.com/" },
        "https://build.example.com"
      )
    ).toBe("https://notify.example.com")
  })

  it("falls back to the build env, then localhost:8787", () => {
    expect(defaultApiUrl({ apiUrl: null }, "https://build.example.com")).toBe(
      "https://build.example.com"
    )
    expect(defaultApiUrl(null, undefined)).toBe("http://localhost:8787")
  })
})

describe("resolveSettings", () => {
  it("uses what the person saved", () => {
    expect(
      resolveSettings(
        JSON.stringify({
          apiUrl: "https://mine.example.com/",
          apiKey: " ntf_x ",
        }),
        "http://localhost:8787"
      )
    ).toEqual({ apiUrl: "https://mine.example.com", apiKey: "ntf_x" })
  })

  it("falls back to the deployment default when nothing or junk is saved", () => {
    expect(resolveSettings(null, "https://notify.example.com")).toEqual({
      apiUrl: "https://notify.example.com",
      apiKey: "",
    })
    expect(resolveSettings("{not json", "https://notify.example.com")).toEqual({
      apiUrl: "https://notify.example.com",
      apiKey: "",
    })
  })
})
