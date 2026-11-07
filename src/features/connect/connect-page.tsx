import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, type FormEvent } from "react"
import { messageOf } from "@/api/client"
import { Mono, PageHeader } from "@/app/page"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
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
import { Spinner } from "@/components/ui/spinner"
import { checkConnection } from "./queries"
import {
  forgetSettings,
  getDeploymentApiUrl,
  saveSettings,
  useSettings,
} from "./settings"

export const ConnectPage = () => {
  const settings = useSettings()
  const queryClient = useQueryClient()
  const [apiUrl, setApiUrl] = useState(settings.apiUrl)
  const [apiKey, setApiKey] = useState(settings.apiKey)
  const check = useMutation({ mutationFn: checkConnection })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const next = { apiUrl, apiKey }
    check.mutate(next, {
      onSuccess: () => {
        saveSettings(next)
        queryClient.clear()
      },
    })
  }

  const onForget = () => {
    forgetSettings()
    setApiUrl(getDeploymentApiUrl())
    setApiKey("")
    check.reset()
    queryClient.clear()
  }

  return (
    <>
      <PageHeader
        title="Connect"
        description="Which notify API this console drives, and the key it uses."
      />
      <div className="grid max-w-5xl gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <form onSubmit={onSubmit} className="contents">
            <CardHeader>
              <CardTitle>API</CardTitle>
              <CardDescription>
                Checked against <Mono>/api/health</Mono> and <Mono>/api</Mono>{" "}
                before it's saved.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="api-url">API URL</FieldLabel>
                  <Input
                    id="api-url"
                    type="url"
                    required
                    value={apiUrl}
                    onChange={(event) => setApiUrl(event.target.value)}
                    placeholder="https://notify.example.com"
                    className="font-mono"
                  />
                  <FieldDescription>
                    This deployment's default is{" "}
                    <Mono>{getDeploymentApiUrl()}</Mono>.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="api-key">API key</FieldLabel>
                  <Input
                    id="api-key"
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    required
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder="ntf_…"
                    className="font-mono"
                  />
                  <FieldDescription>
                    Kept in this browser's localStorage, sent only to the API
                    URL above as <Mono>Authorization: Bearer</Mono>.
                  </FieldDescription>
                </Field>
              </FieldGroup>
              {check.isError ? (
                <Alert variant="destructive" className="mt-4">
                  <AlertTitle>Not saved</AlertTitle>
                  <AlertDescription>{messageOf(check.error)}</AlertDescription>
                </Alert>
              ) : null}
              {check.isSuccess ? (
                <Alert className="mt-4">
                  <AlertTitle>Connected</AlertTitle>
                  <AlertDescription>
                    {check.data.name} {check.data.version}, key accepted. Saved.
                  </AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
            <CardFooter className="justify-between gap-2">
              <Button type="button" variant="ghost" onClick={onForget}>
                Forget key
              </Button>
              <Button type="submit" disabled={check.isPending}>
                {check.isPending ? <Spinner data-icon="inline-start" /> : null}
                Check and save
              </Button>
            </CardFooter>
          </form>
        </Card>

        <aside className="flex flex-col gap-4 text-xs text-muted-foreground">
          <section className="flex flex-col gap-1.5">
            <h2 className="font-medium text-foreground">Keys</h2>
            <p>
              Mint one per client: <Mono>ntf_…</Mono> goes here, its sha256 goes
              into the API's <Mono>API_KEYS</Mono>. Any script on this origin
              can read localStorage, so use a key you can revoke and keep this
              console on its own origin.
            </p>
          </section>
          <section className="flex flex-col gap-1.5">
            <h2 className="font-medium text-foreground">Self-hosting</h2>
            <p>
              Put Cloudflare Access (or any SSO proxy) in front of the console's
              host so only you can load it. The API must list this origin in{" "}
              <Mono>CONSOLE_ORIGINS</Mono> or the browser blocks every call.
            </p>
          </section>
        </aside>
      </div>
    </>
  )
}
