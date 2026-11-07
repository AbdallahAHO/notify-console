import { useNavigate, Link } from "@tanstack/react-router"
import { useState } from "react"
import { ago, ErrorAlert, RequireKey } from "@/app/states"
import { PageHeader } from "@/app/page"
import { buttonVariants } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Presence, Tags } from "./destination-bits"
import { useDestinations, type DestinationFilter } from "./queries"

type KindFilter = "all" | "device" | "webhook"

const DestinationsTable = ({ filter }: { filter: DestinationFilter }) => {
  const destinations = useDestinations(filter)
  const navigate = useNavigate()

  if (destinations.isPending)
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-8 w-full" />
        ))}
      </div>
    )
  if (destinations.isError)
    return (
      <ErrorAlert
        title="Couldn't load destinations"
        error={destinations.error}
      />
    )
  if (!destinations.data.length)
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>No destinations yet</EmptyTitle>
          <EmptyDescription>
            Enroll a device over USB or with its pairing code, or add a webhook.
          </EmptyDescription>
        </EmptyHeader>
        <Link
          to="/enroll"
          search={{ method: "usb" }}
          className={buttonVariants({ variant: "outline" })}
        >
          Enroll
        </Link>
      </Empty>
    )

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead>State</TableHead>
            <TableHead>Last seen</TableHead>
            <TableHead className="text-right">Id</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {destinations.data.map((destination) => (
            <TableRow
              key={destination.id}
              className="cursor-pointer"
              onClick={() =>
                navigate({
                  to: "/destinations/$id",
                  params: { id: destination.id },
                })
              }
            >
              <TableCell className="font-medium">
                <Link
                  to="/destinations/$id"
                  params={{ id: destination.id }}
                  className="hover:underline"
                  onClick={(event) => event.stopPropagation()}
                >
                  {destination.name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {destination.kind}
              </TableCell>
              <TableCell>
                <Tags tags={destination.tags} />
              </TableCell>
              <TableCell>
                <Presence destination={destination} />
              </TableCell>
              <TableCell
                className="text-muted-foreground"
                title={destination.lastSeenAt ?? undefined}
              >
                {destination.kind === "device"
                  ? ago(destination.lastSeenAt)
                  : "—"}
              </TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">
                {destination.id}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export const DestinationsPage = () => {
  const [kind, setKind] = useState<KindFilter>("all")
  const [includeRevoked, setIncludeRevoked] = useState(false)

  return (
    <>
      <PageHeader
        title="Destinations"
        description="Devices and webhooks asks can go to. Refreshes every 5 s."
        actions={
          <Link
            to="/enroll"
            search={{ method: "usb" }}
            className={buttonVariants()}
          >
            Enroll
          </Link>
        }
      />
      <div className="flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center gap-4">
          <ToggleGroup
            variant="outline"
            size="sm"
            value={[kind]}
            onValueChange={(value) =>
              value[0] && setKind(value[0] as KindFilter)
            }
          >
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            <ToggleGroupItem value="device">Devices</ToggleGroupItem>
            <ToggleGroupItem value="webhook">Webhooks</ToggleGroupItem>
          </ToggleGroup>
          <Label className="flex items-center gap-2 text-xs font-normal">
            <Checkbox
              checked={includeRevoked}
              onCheckedChange={(checked) => setIncludeRevoked(checked === true)}
            />
            Show revoked
          </Label>
        </div>
        <RequireKey>
          <DestinationsTable
            filter={{ kind: kind === "all" ? undefined : kind, includeRevoked }}
          />
        </RequireKey>
      </div>
    </>
  )
}
