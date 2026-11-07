import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider, type RouterHistory } from "@tanstack/react-router"
import { useState } from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toast"
import { TooltipProvider } from "@/components/ui/tooltip"
import { createAppRouter } from "./router"

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
  })

/** The whole console; tests pass a memory history and their own query client. */
export const App = ({
  history,
  queryClient: givenQueryClient,
}: {
  history?: RouterHistory
  queryClient?: QueryClient
}) => {
  const [queryClient] = useState(() => givenQueryClient ?? createQueryClient())
  const [router] = useState(() => createAppRouter({ queryClient, history }))
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster>
            <RouterProvider router={router} />
          </Toaster>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
