import { Link01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { messageOf } from "@/api/client"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { buttonVariants } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { useSettings } from "@/features/connect/settings"

/** Renders children once an API key is set, else points to Connect. */
export const RequireKey = ({ children }: { children: ReactNode }) => {
  const { apiKey } = useSettings()
  if (apiKey) return children
  return (
    <Empty className="m-6 border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={Link01Icon} strokeWidth={2} />
        </EmptyMedia>
        <EmptyTitle>Not connected</EmptyTitle>
        <EmptyDescription>
          Add the notify API URL and an API key first.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link to="/connect" className={buttonVariants()}>
          Connect
        </Link>
      </EmptyContent>
    </Empty>
  )
}

export const ErrorAlert = ({
  title,
  error,
}: {
  title: string
  error: unknown
}) => (
  <Alert variant="destructive">
    <AlertTitle>{title}</AlertTitle>
    <AlertDescription>{messageOf(error)}</AlertDescription>
  </Alert>
)

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400],
  ["hour", 3600],
  ["minute", 60],
  ["second", 1],
]
const relative = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
  style: "short",
})

/** "3 min. ago" for an ISO time; "never" for null. */
export const ago = (iso: string | null | undefined, now = Date.now()) => {
  if (!iso) return "never"
  const seconds = Math.round((Date.parse(iso) - now) / 1000)
  const [unit, size] = UNITS.find(([, size]) => Math.abs(seconds) >= size) ?? [
    "second",
    1,
  ]
  return relative.format(Math.round(seconds / size), unit)
}
