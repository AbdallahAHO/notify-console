import { useMutation } from "@tanstack/react-query"
import { useState, type FormEvent } from "react"
import { messageOf, notifyClient, unwrap } from "@/api/client"
import { Mono } from "@/app/page"
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { useSettings } from "@/features/connect/settings"
import { useDestinationsRefresh } from "@/features/destinations/queries"
import { parseTags } from "@/features/destinations/tags"
import { NameTagsFields } from "../name-tags-fields"
import { WaitOnline } from "../wait-online"
import { normalizeCode } from "./code"

export const PairingForm = () => {
  const settings = useSettings()
  const refresh = useDestinationsRefresh()
  const [typed, setTyped] = useState("")
  const [name, setName] = useState("")
  const [tagsText, setTagsText] = useState("")
  const code = normalizeCode(typed)
  const { tags, error: tagsError } = parseTags(tagsText)
  const approve = useMutation({
    mutationFn: async () =>
      unwrap(
        await notifyClient(settings).POST("/api/devices/pair/approve", {
          body: { code: code!, name: name.trim(), tags },
        })
      ),
    onSuccess: refresh,
  })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (code && !tagsError) approve.mutate()
  }

  if (approve.isSuccess)
    return (
      <div className="flex max-w-xl flex-col gap-3">
        <WaitOnline
          id={approve.data.id}
          hint="The device collects its token on its next poll (every 5 s) and connects."
        />
        <Button
          variant="ghost"
          className="self-start"
          onClick={() => {
            approve.reset()
            setTyped("")
            setName("")
            setTagsText("")
          }}
        >
          Pair another
        </Button>
      </div>
    )

  const codeError =
    typed.trim() && !code
      ? "6 characters: letters and digits 2–9, without I, L, O, U"
      : null
  return (
    <Card className="max-w-xl">
      <form onSubmit={onSubmit} className="contents">
        <CardHeader>
          <CardTitle>Pairing code</CardTitle>
          <CardDescription>
            On a device that's on Wi-Fi and knows this API's URL, start pairing
            (<Mono>{'{"cmd":"notifylink","url":…,"pair":true}'}</Mono>). It
            shows a code for 10 minutes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={Boolean(codeError) || undefined}>
              <FieldLabel htmlFor="pairing-code">Code on the device</FieldLabel>
              <Input
                id="pairing-code"
                required
                autoComplete="off"
                spellCheck={false}
                aria-invalid={Boolean(codeError) || undefined}
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                placeholder="K7M-4QX"
                className="h-10 max-w-48 font-mono text-lg tracking-[0.2em] uppercase"
              />
              {codeError ? (
                <FieldError>{codeError}</FieldError>
              ) : (
                <FieldDescription>
                  Case and the dash don't matter.
                </FieldDescription>
              )}
            </Field>
            <NameTagsFields
              name={name}
              onName={setName}
              tagsText={tagsText}
              onTagsText={setTagsText}
              namePlaceholder="Desk Muma"
            />
          </FieldGroup>
          {approve.isError ? (
            <p className="mt-3 text-xs text-destructive">
              {approve.error instanceof Error &&
              "status" in approve.error &&
              approve.error.status === 404
                ? "No pairing with that code: it may have expired (10 min) or been used. Start pairing again on the device."
                : messageOf(approve.error)}
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            type="submit"
            disabled={
              !code || !name.trim() || Boolean(tagsError) || approve.isPending
            }
          >
            {approve.isPending ? <Spinner data-icon="inline-start" /> : null}
            Approve
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
