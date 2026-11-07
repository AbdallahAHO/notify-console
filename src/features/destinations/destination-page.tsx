import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link, useNavigate } from "@tanstack/react-router"
import { useState, type FormEvent, type ReactNode } from "react"
import { messageOf } from "@/api/client"
import { Mono, PageHeader } from "@/app/page"
import { ago, ErrorAlert, RequireKey } from "@/app/states"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { Presence, Tags } from "./destination-bits"
import {
  useDestination,
  useRevokeDestination,
  useUpdateDestination,
  type Destination,
} from "./queries"
import { parseTags } from "./tags"

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-baseline gap-3 py-1.5 text-xs">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="min-w-0 break-words">{children}</dd>
  </div>
)

const EditForm = ({ destination }: { destination: Destination }) => {
  const [name, setName] = useState(destination.name)
  const [tagsText, setTagsText] = useState(destination.tags.join(", "))
  const update = useUpdateDestination()
  const { tags, error: tagsError } = parseTags(tagsText)
  const unchanged =
    name.trim() === destination.name && tags.join() === destination.tags.join()

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (tagsError) return
    update.mutate(
      { id: destination.id, name: name.trim(), tags },
      {
        onSuccess: () =>
          toast.add({
            title: "Saved",
            description: `${name.trim()} · ${tags.length} tags`,
          }),
      }
    )
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="contents">
        <CardHeader>
          <CardTitle>Name and tags</CardTitle>
          <CardDescription>
            Asks sent to <Mono>tag:&lt;tag&gt;</Mono> reach every destination
            carrying it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="destination-name">Name</FieldLabel>
              <Input
                id="destination-name"
                required
                maxLength={60}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field data-invalid={Boolean(tagsError) || undefined}>
              <FieldLabel htmlFor="destination-tags">Tags</FieldLabel>
              <Input
                id="destination-tags"
                aria-invalid={Boolean(tagsError) || undefined}
                value={tagsText}
                onChange={(event) => setTagsText(event.target.value)}
                placeholder="desk, home"
                className="font-mono"
              />
              {tagsError ? (
                <FieldError>{tagsError}</FieldError>
              ) : (
                <FieldDescription>Comma or space separated.</FieldDescription>
              )}
            </Field>
          </FieldGroup>
          {update.isError ? (
            <p className="mt-3 text-xs text-destructive">
              {messageOf(update.error)}
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            type="submit"
            disabled={unchanged || Boolean(tagsError) || update.isPending}
          >
            {update.isPending ? <Spinner data-icon="inline-start" /> : null}
            Save
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

const RevokeButton = ({ destination }: { destination: Destination }) => {
  const revoke = useRevokeDestination()
  const navigate = useNavigate()
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive" />}>
        Revoke
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke {destination.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {destination.kind === "device"
              ? "Its token stops working and a connected device is closed (it stops reconnecting). "
              : "Asks stop being POSTed to its URL. "}
            Open deliveries are retracted. This can't be undone: enroll it again
            to bring it back.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {revoke.isError ? (
          <p className="text-xs text-destructive">{messageOf(revoke.error)}</p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel>Keep</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={revoke.isPending}
            onClick={() =>
              revoke.mutate(destination.id, {
                onSuccess: () => {
                  toast.add({ title: "Revoked", description: destination.name })
                  navigate({ to: "/destinations" })
                },
              })
            }
          >
            {revoke.isPending ? <Spinner data-icon="inline-start" /> : null}
            Revoke
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

const DestinationDetail = ({ id }: { id: string }) => {
  const destination = useDestination(id)
  if (destination.isPending) return <Skeleton className="m-6 h-48 max-w-3xl" />
  if (destination.isError)
    return (
      <div className="p-6">
        <ErrorAlert title={`Couldn't load ${id}`} error={destination.error} />
      </div>
    )
  const value = destination.data
  return (
    <>
      <PageHeader
        title={value.name}
        description={<Mono>{value.id}</Mono>}
        actions={value.revokedAt ? null : <RevokeButton destination={value} />}
      />
      <div className="grid max-w-5xl gap-6 p-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              {value.kind === "device" ? "Device" : "Webhook"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y">
              <Row label="State">
                <Presence destination={value} />
              </Row>
              <Row label="Tags">
                <Tags tags={value.tags} />
              </Row>
              {value.url ? (
                <Row label="URL">
                  <Mono>{value.url}</Mono>
                </Row>
              ) : null}
              {value.kind === "device" ? (
                <Row label="Last seen">
                  <span title={value.lastSeenAt ?? undefined}>
                    {ago(value.lastSeenAt)}
                  </span>
                </Row>
              ) : null}
              <Row label="Created">
                {new Date(value.createdAt).toLocaleString()}
              </Row>
              {value.revokedAt ? (
                <Row label="Revoked">
                  {new Date(value.revokedAt).toLocaleString()}
                </Row>
              ) : null}
            </dl>
          </CardContent>
        </Card>
        {value.revokedAt ? null : (
          <EditForm key={value.id} destination={value} />
        )}
        {value.kind === "device" ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Last status</CardTitle>
              <CardDescription>
                The last status frame the device sent, as sent.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 font-mono text-[11px] leading-relaxed">
                {value.lastStatus
                  ? JSON.stringify(value.lastStatus, null, 2)
                  : "none yet"}
              </pre>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  )
}

export const DestinationPage = ({ id }: { id: string }) => (
  <>
    <div className="px-6 pt-4">
      <Link
        to="/destinations"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <HugeiconsIcon
          icon={ArrowLeft01Icon}
          strokeWidth={2}
          data-icon="inline-start"
        />
        Destinations
      </Link>
    </div>
    <RequireKey>
      <DestinationDetail id={id} />
    </RequireKey>
  </>
)
