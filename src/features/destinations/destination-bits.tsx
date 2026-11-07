import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Destination } from "./queries"

/** A device's connection dot, or "webhook"/"revoked". */
export const Presence = ({ destination }: { destination: Destination }) => {
  if (destination.revokedAt) return <Badge variant="destructive">revoked</Badge>
  if (destination.kind === "webhook")
    return <span className="text-muted-foreground">push</span>
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "size-1.5 rounded-full",
          destination.online ? "bg-success" : "bg-muted-foreground/40"
        )}
        aria-hidden
      />
      {destination.online ? "online" : "offline"}
    </span>
  )
}

export const Tags = ({ tags }: { tags: string[] }) =>
  tags.length ? (
    <span className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <Badge key={tag} variant="outline" className="font-mono">
          {tag}
        </Badge>
      ))}
    </span>
  ) : (
    <span className="text-muted-foreground">—</span>
  )
