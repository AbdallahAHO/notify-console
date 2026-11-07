import { describe, expect, it } from "vitest"
import { normalizeCode } from "./code"

describe("normalizeCode", () => {
  it.each(["K7M-4QX", "k7m4qx", " k7m 4qx ", "K7M_4QX"])(
    "reads %j as K7M-4QX",
    (typed) => {
      expect(normalizeCode(typed)).toBe("K7M-4QX")
    }
  )

  it("rejects short codes and characters the alphabet leaves out", () => {
    expect(normalizeCode("K7M-4Q")).toBeNull()
    expect(normalizeCode("K7M-4QO")).toBeNull()
    expect(normalizeCode("I0L-1UX")).toBeNull()
  })
})
