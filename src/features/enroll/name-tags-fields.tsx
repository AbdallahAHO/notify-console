import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { parseTags } from "@/features/destinations/tags"

/** The name and tags every enrollment asks for. */
export const NameTagsFields = ({
  name,
  onName,
  tagsText,
  onTagsText,
  namePlaceholder,
}: {
  name: string
  onName: (name: string) => void
  tagsText: string
  onTagsText: (text: string) => void
  namePlaceholder: string
}) => {
  const { error } = parseTags(tagsText)
  return (
    <>
      <Field>
        <FieldLabel htmlFor="enroll-name">Name</FieldLabel>
        <Input
          id="enroll-name"
          required
          maxLength={60}
          value={name}
          onChange={(event) => onName(event.target.value)}
          placeholder={namePlaceholder}
        />
      </Field>
      <Field data-invalid={Boolean(error) || undefined}>
        <FieldLabel htmlFor="enroll-tags">Tags</FieldLabel>
        <Input
          id="enroll-tags"
          aria-invalid={Boolean(error) || undefined}
          value={tagsText}
          onChange={(event) => onTagsText(event.target.value)}
          placeholder="desk, home"
          className="font-mono"
        />
        {error ? (
          <FieldError>{error}</FieldError>
        ) : (
          <FieldDescription>
            Asks to <span className="font-mono">tag:desk</span> reach every
            destination tagged desk.
          </FieldDescription>
        )}
      </Field>
    </>
  )
}
