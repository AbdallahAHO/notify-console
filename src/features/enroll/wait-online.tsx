import { Link } from "@tanstack/react-router"
import { Mono } from "@/app/page"
import { ErrorAlert } from "@/app/states"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { buttonVariants } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useDestination } from "@/features/destinations/queries"

/** Polls a new device until it holds its connection, then links to it. */
export const WaitOnline = ({ id, hint }: { id: string; hint: string }) => {
  const destination = useDestination(id, 2000)
  if (destination.isError)
    return (
      <ErrorAlert title={`Couldn't read ${id}`} error={destination.error} />
    )
  if (!destination.data?.online)
    return (
      <Alert>
        <Spinner />
        <AlertTitle>
          Waiting for {destination.data?.name ?? "the device"} to connect…
        </AlertTitle>
        <AlertDescription>
          Enrolled as <Mono>{id}</Mono>. {hint}
        </AlertDescription>
      </Alert>
    )
  return (
    <Alert>
      <AlertTitle>{destination.data.name} is online</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-2">
        <span>
          Enrolled as <Mono>{id}</Mono> and connected. Send it a test ask.
        </span>
        <span className="flex gap-2">
          <Link to="/asks" className={buttonVariants({ size: "sm" })}>
            Send a test ask
          </Link>
          <Link
            to="/destinations/$id"
            params={{ id }}
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            Open destination
          </Link>
        </span>
      </AlertDescription>
    </Alert>
  )
}
