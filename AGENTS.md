# notify-console

The owner's admin console for the notify API (sibling repo `../notify`): enroll ESP32 devices (Web Serial or pairing
code) and webhooks, manage destinations, send test asks and watch deliveries. A static SPA; it talks only to the
configured notify API with a bearer key. Public, MIT.

## Commands

`pnpm dev` (port 5173, strict: notify's default `CONSOLE_ORIGINS`) · `pnpm test` · `pnpm typecheck` · `pnpm lint` ·
`pnpm build` · `pnpm run deploy` (build + `wrangler deploy`; never `pnpm deploy`) · `pnpm run deploy:dry` ·
`pnpm api:types <url|file>` (default `http://localhost:8787/openapi.json`) after notify's API changes.

## Layout

| Path | What |
|---|---|
| `src/app/` | providers (`app.tsx`), code-based routes (`router.tsx`), the shell, page header, shared empty/error states |
| `src/api/` | `client.ts` (openapi-fetch, `unwrap` → `ApiError` from problem+json), generated `schema.d.ts` + `openapi.json` |
| `src/features/connect/` | settings store (localStorage › `/config.json` › `VITE_NOTIFY_API_URL` › localhost:8787), connection check |
| `src/features/destinations/` | list, detail, rename/retag, revoke; `tags.ts` (the one tag parser) |
| `src/features/enroll/usb/` | Web Serial: `frames.ts` (line-JSON + Improv split), `improv.ts`, `link.ts` (acks by `ack` name), `enroll.ts` (the sequence) |
| `src/features/enroll/pairing/`, `webhook/` | pairing-code approve, webhook enroll with the show-once secret |
| `src/features/asks/` | `compose.ts` (the API's limits, `mergeAsks` for `updatedSince` polling), form, live list |
| `src/components/ui/` | shadcn (base-ui, `base-mira` style, hugeicons); edited: `toggle.tsx` pressed state, `spinner.tsx` typing |
| `src/test/` | MSW in-memory notify (`server.ts`), OpenAPI-shaped fixtures, `fake-port.ts` (a glance board), `renderApp` |
| `wrangler.jsonc`, `public/_headers` | Worker with static assets only, SPA fallback |
| `Dockerfile`, `docker/` | nginx image; `40-notify-config.sh` writes `/config.json` from `NOTIFY_API_URL` at start |

## Invariants

- **Secrets never land in state that outlives the step.** The device token stays inside `enrollOverUsb` (a local,
  cleared in `finally`) and goes only to the serial port; nothing returns, logs or caches it. The webhook secret lives in
  the form's `useState`, never in TanStack Query. A test asserts each.
- USB enroll has two modes. `token`: POST the destination, write the token with `notifylink`. `pair`: send
  `notifylink` with `pair:true` and `console:<this host>`, read `status.data.notify.{pair,code}` over USB, then
  `POST /api/devices/pair/approve`; no token passes through the browser.
- Never depend on async acks over USB (the firmware's are unreliable): a missing `wifi`/`notifylink` ack means "carry
  on and watch `status` and the destination's `online`". Only an explicit `ok:false` fails a step, and only a refused
  `notifylink` revokes the destination just created (its token is gone).
- Client rules mirror the API so a form never earns a 400/422: title 40, body 160, ≤4 actions × 12, ttl 10–86400;
  messages/notifications send no `actions`; approvals may omit them (server default Approve/Deny).
- The serial link matches answers by `ack` name and ignores every other line (the board also echoes notify acks and
  vdp stripes). Improv packets are recognised only at a line start; a failed Improv probe sends `\n` so the board's
  line buffer doesn't swallow the next JSON command.
- Query keys start with the API URL; saving Connect clears the cache. The key itself is never in a query key.

## Gotchas

- MSW is v3: `server.listen({ onUnhandledFrame: "error" })`, not `onUnhandledRequest`.
- `openapi-fetch` gets `fetch: (r) => globalThis.fetch(r)` so MSW (patched after import) intercepts it.
- Opening a port resets some boards: `openLink` waits 2 s before the first command. Web Serial filter: vendor 0x303a.
- A board can't reach `localhost`: the USB form flags loopback device URLs; dev needs notify on `--ip 0.0.0.0`.
- pnpm `allowBuilds` in `pnpm-workspace.yaml` must keep `workerd: true` or installing wrangler fails.

## Deploying

- Cloudflare: Worker `notify-console` serves the built SPA as static assets. Set `account_id` and the route in
  `wrangler.jsonc` (or delete them for workers.dev), then `VITE_NOTIFY_API_URL=https://<your notify> pnpm run deploy`
  with `CLOUDFLARE_API_TOKEN` in the environment. CI deploys a `v*` tag (or a manual run) with repo secrets
  `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and the variable `NOTIFY_API_URL`.
- Add the console's origin to notify's `CONSOLE_ORIGINS`, and put the console behind an access layer (it holds an
  API key in the browser).
- Docker / Coolify: the nginx image reads `/config.json` at start (see README).
- The maintainer's production runbook (accounts, tokens, tags) lives outside this repo; nothing here depends on it.
