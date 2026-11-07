import createClient from "openapi-fetch"
import { getSettings, type Settings } from "@/features/connect/settings"
import type { components, paths } from "./schema"

export type Destination = components["schemas"]["Destination"]
export type DestinationCreated = components["schemas"]["DestinationCreated"]
export type Ask = components["schemas"]["Ask"]
export type AskInput = components["schemas"]["AskInput"]
export type AskList = components["schemas"]["AskList"]
export type Delivery = components["schemas"]["Delivery"]
export type Problem = components["schemas"]["Problem"]

/** A notify answer that wasn't 2xx, carrying its problem+json details. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string | undefined
  readonly detail: string | undefined

  constructor(status: number, problem: Partial<Problem> | undefined) {
    super(problem?.detail ?? problem?.title ?? `HTTP ${status}`)
    this.name = "ApiError"
    this.status = status
    this.code = problem?.code
    this.detail = problem?.detail
  }
}

/** A typed notify client for these settings; the key goes in `Authorization: Bearer`. */
export const notifyClient = ({ apiUrl, apiKey }: Settings = getSettings()) =>
  createClient<paths>({
    baseUrl: apiUrl,
    headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {},
    fetch: (request) => globalThis.fetch(request),
  })

export type NotifyClient = ReturnType<typeof notifyClient>

/** The data of an openapi-fetch result, or an ApiError for its problem. */
export const unwrap = <Data>(result: {
  data?: Data
  error?: unknown
  response: Response
}): Data => {
  if (result.error !== undefined || !result.response.ok)
    throw new ApiError(result.response.status, result.error as Partial<Problem>)
  return result.data as Data
}

/** The human sentence for any thrown error. */
export const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? `${error.message}${error.code ? ` (${error.code})` : ""}`
    : error instanceof TypeError
      ? "Can't reach the API: check the URL, that it's running, and that CONSOLE_ORIGINS allows this origin."
      : error instanceof Error
        ? error.message
        : String(error)
