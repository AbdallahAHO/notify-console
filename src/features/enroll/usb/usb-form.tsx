import {
  Alert02Icon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  UsbConnected01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link } from "@tanstack/react-router"
import { useEffect, useRef, useState, type FormEvent } from "react"
import { messageOf, notifyClient, type Destination } from "@/api/client"
import { Mono } from "@/app/page"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { useSettings } from "@/features/connect/settings"
import { useDestinationsRefresh } from "@/features/destinations/queries"
import { parseTags } from "@/features/destinations/tags"
import { cn } from "@/lib/utils"
import { NameTagsFields } from "../name-tags-fields"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  describeStatus,
  deviceSocketUrl,
  enrollOverUsb,
  isLoopback,
  STEPS,
  type DeviceStatus,
  type EnrollMode,
  type EnrollStep,
  type StepState,
} from "./enroll"
import { openLink, pickPort, webSerialSupported, type SerialLink } from "./link"

const STEP_LABELS: Record<EnrollStep, string> = {
  status: "Read device status",
  wifi: "Join Wi-Fi",
  enroll: "Create the destination",
  link: "Send the token over USB",
  pair: "Start pairing, read the code",
  approve: "Approve the code",
  online: "Wait for it to connect",
}

const MODE_HELP: Record<EnrollMode, string> = {
  token:
    "The API's token goes straight to the board over USB; this page never shows or keeps it.",
  pair: "The board asks the API for a pairing code; the console reads it over USB and approves it, and the board fetches its own token.",
}

type Steps = Partial<Record<EnrollStep, { state: StepState; detail?: string }>>

const StepList = ({ mode, steps }: { mode: EnrollMode; steps: Steps }) => (
  <ol className="flex flex-col gap-2">
    {STEPS[mode].map((step, index) => {
      const { state, detail } = steps[step] ?? { state: "pending" as const }
      return (
        <li
          key={step}
          className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-2 text-xs"
          data-state={state}
        >
          <span className="flex size-5 items-center justify-center">
            {state === "running" ? (
              <Spinner />
            ) : state === "done" || state === "skipped" ? (
              <HugeiconsIcon
                icon={CheckmarkCircle02Icon}
                strokeWidth={2}
                className="size-4 text-success"
              />
            ) : state === "failed" ? (
              <HugeiconsIcon
                icon={CancelCircleIcon}
                strokeWidth={2}
                className="size-4 text-destructive"
              />
            ) : (
              <span className="font-mono text-muted-foreground">
                {index + 1}
              </span>
            )}
          </span>
          <span className="flex min-w-0 flex-col">
            <span
              className={cn(
                state === "pending" && "text-muted-foreground",
                state === "failed" && "text-destructive"
              )}
            >
              {STEP_LABELS[step]}
            </span>
            {detail ? (
              <span
                className={cn(
                  "break-words text-muted-foreground",
                  state === "failed" && "text-destructive"
                )}
              >
                {detail}
              </span>
            ) : null}
          </span>
        </li>
      )
    })}
  </ol>
)

const Unsupported = () => (
  <Alert className="max-w-xl">
    <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
    <AlertTitle>This browser can't open USB serial ports</AlertTitle>
    <AlertDescription>
      Web Serial needs Chrome or Edge on a desktop. Here, enroll with the
      device's{" "}
      <Link to="/enroll" search={{ method: "code" }} className="underline">
        pairing code
      </Link>{" "}
      instead.
    </AlertDescription>
  </Alert>
)

export const UsbForm = () => {
  const settings = useSettings()
  const refresh = useDestinationsRefresh()
  const linkRef = useRef<SerialLink | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [status, setStatus] = useState<DeviceStatus | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [name, setName] = useState("")
  const [tagsText, setTagsText] = useState("")
  const [deviceUrl, setDeviceUrl] = useState(() =>
    deviceSocketUrl(settings.apiUrl)
  )
  const [ssid, setSsid] = useState("")
  const [pass, setPass] = useState("")
  const [mode, setMode] = useState<EnrollMode>("token")
  const [steps, setSteps] = useState<Steps | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [enrolled, setEnrolled] = useState<Destination | null>(null)
  const { tags, error: tagsError } = parseTags(tagsText)
  const running =
    steps !== null &&
    !enrolled &&
    Object.values(steps).some((step) => step?.state === "running")

  useEffect(() => () => void linkRef.current?.close(), [])

  if (!webSerialSupported()) return <Unsupported />

  const disconnect = async () => {
    await linkRef.current?.close()
    linkRef.current = null
    setStatus(null)
    setSteps(null)
  }

  const connect = async () => {
    setError(null)
    setConnecting(true)
    try {
      const port = await pickPort()
      if (!port) return
      const link = await openLink(port)
      linkRef.current = link
      port.addEventListener("disconnect", () => {
        linkRef.current = null
        setStatus(null)
      })
      const ack = await link.request({ cmd: "status" })
      const data = (ack.data ?? {}) as DeviceStatus
      setStatus(data)
      if (data.wifi?.ssid) setSsid(data.wifi.ssid)
    } catch (caught) {
      setError(caught)
      await disconnect()
    } finally {
      setConnecting(false)
    }
  }

  const onEnroll = async (event: FormEvent) => {
    event.preventDefault()
    const link = linkRef.current
    if (!link || tagsError) return
    setError(null)
    setEnrolled(null)
    setSteps({})
    setCode(null)
    const joinWifi =
      status?.wifi?.state !== "online" ||
      (ssid.trim() && ssid.trim() !== status?.wifi?.ssid)
    try {
      const destination = await enrollOverUsb(
        {
          mode,
          consoleHost: window.location.host,
          name: name.trim(),
          tags,
          deviceUrl: deviceUrl.trim(),
          wifi:
            joinWifi && ssid.trim() ? { ssid: ssid.trim(), pass } : undefined,
        },
        {
          link,
          client: notifyClient(settings),
          onCode: setCode,
          onStep: (step, state, detail) =>
            setSteps((current) => ({ ...current, [step]: { state, detail } })),
        }
      )
      setEnrolled(destination)
      setPass("")
    } catch (caught) {
      setError(caught)
    } finally {
      refresh()
    }
  }

  return (
    <div className="grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <Card>
        <form onSubmit={onEnroll} className="contents">
          <CardHeader>
            <CardTitle>Device over USB</CardTitle>
            <CardDescription>
              Plug in a board running buddy-kit glance (Chrome or Edge).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-3 rounded-md border px-3 py-2.5">
              <HugeiconsIcon
                icon={UsbConnected01Icon}
                strokeWidth={2}
                className="size-4 text-muted-foreground"
              />
              <span className="min-w-0 flex-1 text-xs">
                {status ? (
                  <>
                    <span className="font-medium">Connected.</span>{" "}
                    <span className="text-muted-foreground">
                      {describeStatus(status)}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    No device. Opening the port may reset the board; it gets 2 s
                    to boot.
                  </span>
                )}
              </span>
              {status ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={disconnect}
                  disabled={running}
                >
                  Disconnect
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={connect}
                  disabled={connecting}
                >
                  {connecting ? <Spinner data-icon="inline-start" /> : null}
                  Choose port
                </Button>
              )}
            </div>

            <FieldGroup>
              <Field>
                <FieldLabel>How the board gets its token</FieldLabel>
                <ToggleGroup
                  variant="outline"
                  aria-label="How the board gets its token"
                  value={[mode]}
                  onValueChange={(value) =>
                    value[0] && setMode(value[0] as EnrollMode)
                  }
                  disabled={running}
                >
                  <ToggleGroupItem value="token">
                    Token over USB
                  </ToggleGroupItem>
                  <ToggleGroupItem value="pair">Pairing code</ToggleGroupItem>
                </ToggleGroup>
                <FieldDescription>{MODE_HELP[mode]}</FieldDescription>
              </Field>
              <NameTagsFields
                name={name}
                onName={setName}
                tagsText={tagsText}
                onTagsText={setTagsText}
                namePlaceholder="Desk Muma"
              />
              <Field data-invalid={isLoopback(deviceUrl) || undefined}>
                <FieldLabel htmlFor="device-url">Device URL</FieldLabel>
                <Input
                  id="device-url"
                  required
                  value={deviceUrl}
                  onChange={(event) => setDeviceUrl(event.target.value)}
                  className="font-mono"
                />
                <FieldDescription>
                  {isLoopback(deviceUrl)
                    ? "The device can't reach localhost: use this computer's LAN address (wrangler dev --ip 0.0.0.0)."
                    : "Where the device dials in: the API's ws(s)://…/api/devices/connect."}
                </FieldDescription>
              </Field>
              <FieldSet>
                <FieldLegend variant="label">Wi-Fi</FieldLegend>
                <FieldDescription>
                  {status?.wifi?.state === "online"
                    ? `On ${status.wifi.ssid ?? "Wi-Fi"} already; change the network to move it.`
                    : "2.4 GHz only. Sent over USB, never to the API."}
                </FieldDescription>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="wifi-ssid">Network</FieldLabel>
                    <Input
                      id="wifi-ssid"
                      value={ssid}
                      onChange={(event) => setSsid(event.target.value)}
                      autoComplete="off"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="wifi-pass">Password</FieldLabel>
                    <Input
                      id="wifi-pass"
                      type="password"
                      value={pass}
                      onChange={(event) => setPass(event.target.value)}
                      autoComplete="off"
                    />
                  </Field>
                </div>
              </FieldSet>
            </FieldGroup>
          </CardContent>
          <CardFooter className="justify-end">
            <Button
              type="submit"
              disabled={
                !status || !name.trim() || Boolean(tagsError) || running
              }
            >
              {running ? <Spinner data-icon="inline-start" /> : null}
              Enroll device
            </Button>
          </CardFooter>
        </form>
      </Card>

      <div className="flex flex-col gap-4">
        {steps ? (
          <StepList mode={mode} steps={steps} />
        ) : (
          <p className="text-xs text-muted-foreground">
            Steps:{" "}
            {STEPS[mode]
              .map((step) => STEP_LABELS[step].toLowerCase())
              .join(" → ")}
            .
          </p>
        )}
        {code && !enrolled ? (
          <div className="flex flex-col gap-1 rounded-md border px-3 py-2.5">
            <span className="text-xs text-muted-foreground">
              Code on the device
            </span>
            <Mono className="text-2xl tracking-[0.2em]">{code}</Mono>
          </div>
        ) : null}
        {error && !steps ? (
          <p className="text-xs text-destructive">{messageOf(error)}</p>
        ) : null}
        {enrolled ? (
          <Alert>
            <AlertTitle>{enrolled.name} is online</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-2">
              <Mono>{enrolled.id}</Mono>
              <Link to="/asks" className={buttonVariants({ size: "sm" })}>
                Send a test ask
              </Link>
            </AlertDescription>
          </Alert>
        ) : null}
      </div>
    </div>
  )
}
