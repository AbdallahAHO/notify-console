import { Alert02Icon, Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link } from "@tanstack/react-router"
import { useEffect, useState, type FormEvent } from "react"
import { messageOf, notifyClient, unwrap } from "@/api/client"
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
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { useSettings } from "@/features/connect/settings"
import { useDestinationsRefresh } from "@/features/destinations/queries"
import { parseTags } from "@/features/destinations/tags"
import { NameTagsFields } from "../name-tags-fields"

export const VERIFY_SNIPPET = `import { createHmac, timingSafeEqual } from "node:crypto"

// rawBody: the request body exactly as received (bytes, before JSON.parse)
const verify = (rawBody, signatureHeader, secret) => {
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex")
  const given = signatureHeader ?? ""
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected))
}

// verify(raw, req.headers["x-notify-signature"], process.env.NOTIFY_WEBHOOK_SECRET)
// then answer: POST payload.answerUrl {"answer":"Yes"} (or {"state":"dismissed"})`

/** The secret, shown this once: copy it, then it's gone from the page. */
const SecretOnce = ({
  id,
  name,
  secret,
  onDone,
}: {
  id: string
  name: string
  secret: string
  onDone: () => void
}) => {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(secret)
    setCopied(true)
  }
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Alert variant="destructive">
        <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
        <AlertTitle>Copy the signing secret now</AlertTitle>
        <AlertDescription>
          It's shown only this once and can't be read again. Lost it? Revoke{" "}
          {name} and enroll the webhook again.
        </AlertDescription>
      </Alert>
      <Card>
        <CardHeader>
          <CardTitle>{name}</CardTitle>
          <CardDescription>
            Enrolled as <Mono>{id}</Mono>. Every POST to it carries{" "}
            <Mono>
              X-Notify-Signature: sha256=&lt;hex HMAC-SHA256 of the raw body&gt;
            </Mono>{" "}
            keyed by this secret.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <InputGroup>
            <InputGroupInput
              readOnly
              aria-label="Signing secret"
              value={secret}
              className="font-mono"
              onFocus={(event) => event.target.select()}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton onClick={copy} aria-label="Copy secret">
                <HugeiconsIcon
                  icon={copied ? Tick02Icon : Copy01Icon}
                  strokeWidth={2}
                />
                {copied ? "Copied" : "Copy"}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <div className="flex flex-col gap-1.5">
            <h3 className="text-xs font-medium">
              Verify before trusting a POST
            </h3>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-[11px] leading-relaxed">
              {VERIFY_SNIPPET}
            </pre>
            <p className="text-xs text-muted-foreground">
              A webhook gets <Mono>{'{"event":"notify",…,"answerUrl":…}'}</Mono>{" "}
              for each ask and{" "}
              <Mono>{'{"event":"retract","id":…,"reason":…}'}</Mono> when it's
              answered elsewhere, cancelled or expired. Both are signed the same
              way.
            </p>
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Link
            to="/destinations/$id"
            params={{ id }}
            className={buttonVariants({ variant: "outline" })}
            onClick={onDone}
          >
            Open destination
          </Link>
          <Button onClick={onDone}>I've stored it</Button>
        </CardFooter>
      </Card>
    </div>
  )
}

type Created = { id: string; name: string; secret: string }

export const WebhookForm = () => {
  const settings = useSettings()
  const refresh = useDestinationsRefresh()
  const [name, setName] = useState("")
  const [tagsText, setTagsText] = useState("")
  const [url, setUrl] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)
  // held in component state only (not the query cache) and dropped on Done or leaving the page
  const [created, setCreated] = useState<Created | null>(null)
  const { tags, error: tagsError } = parseTags(tagsText)

  useEffect(() => () => setCreated(null), [])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (tagsError) return
    setPending(true)
    setError(null)
    try {
      const destination = unwrap(
        await notifyClient(settings).POST("/api/destinations", {
          body: { kind: "webhook", name: name.trim(), tags, url: url.trim() },
        })
      )
      setCreated({
        id: destination.id,
        name: destination.name,
        secret: destination.secret ?? "",
      })
      setName("")
      setTagsText("")
      setUrl("")
      refresh()
    } catch (caught) {
      setError(caught)
    } finally {
      setPending(false)
    }
  }

  if (created)
    return <SecretOnce {...created} onDone={() => setCreated(null)} />

  return (
    <Card className="max-w-xl">
      <form onSubmit={onSubmit} className="contents">
        <CardHeader>
          <CardTitle>Webhook</CardTitle>
          <CardDescription>
            Each ask is POSTed to this URL, signed; it answers by POSTing to the
            ask's <Mono>answerUrl</Mono>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <NameTagsFields
              name={name}
              onName={setName}
              tagsText={tagsText}
              onTagsText={setTagsText}
              namePlaceholder="n8n approvals"
            />
            <Field>
              <FieldLabel htmlFor="webhook-url">URL</FieldLabel>
              <Input
                id="webhook-url"
                type="url"
                required
                pattern="https?://.+"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://n8n.example.com/webhook/notify"
                className="font-mono"
              />
              <FieldDescription>
                http or https. The signing secret is shown once, next.
              </FieldDescription>
            </Field>
          </FieldGroup>
          {error ? (
            <p className="mt-3 text-xs text-destructive">{messageOf(error)}</p>
          ) : null}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={pending || Boolean(tagsError)}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            Enroll webhook
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
