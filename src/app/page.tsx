import type { ReactNode } from "react"

/** A page's title row: what it is, one line on what it's for, and its actions. */
export const PageHeader = ({
  title,
  description,
  actions,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
}) => (
  <header className="flex flex-wrap items-end justify-between gap-3 border-b px-6 pt-6 pb-4">
    <div className="flex min-w-0 flex-col gap-1">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
    {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
  </header>
)

/** Monospace for ids, keys and wire values. */
export const Mono = ({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) => (
  <span className={`font-mono text-[0.8em] ${className ?? ""}`}>
    {children}
  </span>
)
