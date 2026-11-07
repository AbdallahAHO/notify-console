/** Pairing codes: 6 Crockford base32 characters without 0 O 1 I L U, shown as XXX-XXX. */
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ"

/** Reads what was typed ("k7m 4qx", "K7M-4QX") as "K7M-4QX", or null while it isn't a whole valid code. */
export const normalizeCode = (typed: string) => {
  const characters = typed.toUpperCase().replace(/[^0-9A-Z]/g, "")
  if (
    characters.length !== 6 ||
    [...characters].some((character) => !CODE_ALPHABET.includes(character))
  )
    return null
  return `${characters.slice(0, 3)}-${characters.slice(3)}`
}
