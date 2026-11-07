import {
  Link01Icon,
  Moon02Icon,
  Sun03Icon,
  TaskDaily01Icon,
  UsbConnected01Icon,
  WebhookIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { Link, Outlet } from "@tanstack/react-router"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { useConnection } from "@/features/connect/queries"
import { useSettings } from "@/features/connect/settings"
import { cn } from "@/lib/utils"

const NAV: {
  to: "/asks" | "/destinations" | "/enroll" | "/connect"
  label: string
  icon: IconSvgElement
}[] = [
  { to: "/asks", label: "Asks", icon: TaskDaily01Icon },
  { to: "/destinations", label: "Destinations", icon: WebhookIcon },
  { to: "/enroll", label: "Enroll", icon: UsbConnected01Icon },
  { to: "/connect", label: "Connect", icon: Link01Icon },
]

const hostOf = (url: string) => {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

const ConnectionBadge = () => {
  const settings = useSettings()
  const connection = useConnection()
  const state = !settings.apiKey
    ? "no key"
    : connection.isPending
      ? "checking"
      : connection.isError
        ? "unreachable"
        : `v${connection.data.version}`
  const tone =
    !settings.apiKey || connection.isError
      ? "bg-destructive"
      : connection.isPending
        ? "bg-warning"
        : "bg-success"
  return (
    <Link
      to="/connect"
      className="flex flex-col gap-0.5 rounded-md px-2 py-1.5 text-xs hover:bg-muted"
    >
      <span className="flex items-center gap-2 font-medium">
        <span className={cn("size-1.5 rounded-full", tone)} aria-hidden />
        {state}
      </span>
      <span className="truncate font-mono text-[11px] text-muted-foreground">
        {hostOf(settings.apiUrl)}
      </span>
    </Link>
  )
}

const ThemeToggle = () => {
  const { theme, setTheme } = useTheme()
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={dark ? "Light theme" : "Dark theme"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      <HugeiconsIcon icon={dark ? Sun03Icon : Moon02Icon} strokeWidth={2} />
    </Button>
  )
}

export const Shell = () => (
  <div className="flex min-h-svh flex-col md:flex-row">
    <aside className="flex shrink-0 flex-row items-center gap-1 border-b bg-sidebar px-3 py-2 md:w-52 md:flex-col md:items-stretch md:border-r md:border-b-0 md:py-4">
      <div className="mr-2 flex items-baseline gap-1.5 px-2 md:mr-0 md:mb-4">
        <span className="font-mono text-sm font-semibold tracking-tight">
          notify
        </span>
        <span className="text-xs text-muted-foreground">console</span>
      </div>
      <nav className="flex flex-row gap-0.5 md:flex-col">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground data-[status=active]:bg-muted data-[status=active]:font-medium data-[status=active]:text-foreground"
          >
            <HugeiconsIcon
              icon={item.icon}
              strokeWidth={2}
              className="size-4"
            />
            <span className="hidden sm:inline">{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-1 md:mt-auto md:ml-0 md:justify-between">
        <ConnectionBadge />
        <ThemeToggle />
      </div>
    </aside>
    <main className="min-w-0 flex-1">
      <Outlet />
    </main>
  </div>
)
