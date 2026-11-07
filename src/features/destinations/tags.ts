/** Tags as notify accepts them: lowercase letters, digits and dashes, at most 32, at most 10. */
export const TAG_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/
export const MAX_TAGS = 10

/** Reads "desk, Home  office" as ["desk", "home", "office"]; `invalid` lists what notify would reject. */
export const parseTags = (text: string) => {
  const tags = [
    ...new Set(
      text
        .split(/[\s,]+/)
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
    ),
  ]
  const invalid = tags.filter((tag) => !TAG_PATTERN.test(tag))
  const error = invalid.length
    ? `Not a tag: ${invalid.join(", ")} (lowercase letters, digits and dashes, ≤ 32)`
    : tags.length > MAX_TAGS
      ? `At most ${MAX_TAGS} tags`
      : null
  return { tags, error }
}
