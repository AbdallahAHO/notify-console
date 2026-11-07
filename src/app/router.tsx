import type { QueryClient } from "@tanstack/react-query"
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
  type RouterHistory,
} from "@tanstack/react-router"
import { AsksPage } from "@/features/asks/asks-page"
import { ConnectPage } from "@/features/connect/connect-page"
import { DestinationPage } from "@/features/destinations/destination-page"
import { DestinationsPage } from "@/features/destinations/destinations-page"
import { EnrollPage } from "@/features/enroll/enroll-page"
import { Shell } from "./shell"

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Shell,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/asks" })
  },
})
const asksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/asks",
  component: AsksPage,
})
const destinationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/destinations",
  component: DestinationsPage,
})
export const destinationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/destinations/$id",
  component: () => <DestinationPage id={destinationRoute.useParams().id} />,
})
export const ENROLL_METHODS = ["usb", "code", "webhook"] as const
export type EnrollMethod = (typeof ENROLL_METHODS)[number]
export const enrollRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/enroll",
  validateSearch: (
    search: Record<string, unknown>
  ): { method: EnrollMethod } => ({
    method: ENROLL_METHODS.includes(search.method as EnrollMethod)
      ? (search.method as EnrollMethod)
      : "usb",
  }),
  component: () => <EnrollPage method={enrollRoute.useSearch().method} />,
})
const connectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/connect",
  component: ConnectPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  asksRoute,
  destinationsRoute,
  destinationRoute,
  enrollRoute,
  connectRoute,
])

export const createAppRouter = ({
  queryClient,
  history,
}: {
  queryClient: QueryClient
  history?: RouterHistory
}) =>
  createRouter({
    routeTree,
    context: { queryClient },
    history,
    defaultPreload: "intent",
  })

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
