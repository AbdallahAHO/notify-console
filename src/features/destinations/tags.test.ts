import { describe, expect, it } from "vitest"
import { parseTags } from "./tags"

describe("parseTags", () => {
  it("splits on commas and spaces, lowercases and dedupes", () => {
    expect(parseTags("Desk, home  desk")).toEqual({
      tags: ["desk", "home"],
      error: null,
    })
  })

  it("names the tags notify would reject", () => {
    expect(parseTags("ok, -bad, no_underscore").error).toMatch(
      /-bad, no_underscore/
    )
  })

  it("caps at 10", () => {
    expect(parseTags("a b c d e f g h i j k").error).toBe("At most 10 tags")
  })
})
