import { createMemoryHistory } from "@tanstack/react-router"
import { render } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { App, createQueryClient } from "@/app/app"
import { forgetSettings, saveSettings } from "@/features/connect/settings"
import { API_KEY, API_URL } from "./fixtures"

/** Renders the whole console at `path`, connected to the MSW notify unless `connected: false`. */
export const renderApp = (path: string, { connected = true } = {}) => {
  if (connected) saveSettings({ apiUrl: API_URL, apiKey: API_KEY })
  else forgetSettings()
  const queryClient = createQueryClient()
  queryClient.setDefaultOptions({
    queries: { retry: false, refetchOnWindowFocus: false },
  })
  const user = userEvent.setup()
  const view = render(
    <App
      history={createMemoryHistory({ initialEntries: [path] })}
      queryClient={queryClient}
    />
  )
  return { ...view, user, queryClient }
}
