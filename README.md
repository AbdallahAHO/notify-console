# notify-console

The admin console for [notify](https://github.com/AbdallahAHO/notify): an API that sends asks (a message,
notification, approval or question) to your ESP32 devices and webhooks and brings the answer back. From the console you
enroll devices over USB or by pairing code, enroll webhooks, manage destinations, and send test asks while their
deliveries move from `queued` to `answered` in front of you.

It's a static single-page app (Vite, React, TanStack Router and Query, shadcn/ui). It talks only to your notify API,
from your browser, with your API key. Host it on Cloudflare, in Docker, or run it locally.

<!-- Screenshots: docs/screenshots/asks.png, destinations.png, enroll-usb.png -->

## What it does

| Screen | What |
|---|---|
| **Asks** | Send a test ask with the API's limits counted as you type (title 40, body 160, up to 4 actions of 12, ttl 10 s to 1 day) to destinations or `tag:` groups. A live list (polled every 2 s with `updatedSince`) shows each delivery's state; cancel open ones. |
| **Destinations** | Devices and webhooks: online state, tags, last seen, the device's last status frame. Rename, retag, revoke (with confirmation). |
| **Enroll → USB** | Chrome or Edge on a desktop (Web Serial). Pick the board, read its status, join Wi-Fi (Improv Serial when the firmware speaks it), then either write a fresh token to the board over USB (never shown or stored) or start the board's own pairing, read its code over USB and approve it. Then wait for it to come online. |
| **Enroll → Pairing code** | Type the `XXX-XXX` code a device shows (case and dash don't matter), name it, and watch it connect. |
| **Enroll → Webhook** | Name, tags, URL. The signing secret is shown once, with how to verify `X-Notify-Signature`. |
| **Connect** | The API URL and key, checked against `/api/health` and `/api` before they're saved. |

## Quickstart

### Local

```bash
pnpm install
cp .env.example .env.local          # VITE_NOTIFY_API_URL=http://localhost:8787
pnpm dev                            # http://localhost:5173
```

Run notify next to it (`pnpm dev` in the notify repo, port 8787). notify allows `http://localhost:5173` by default
(`CONSOLE_ORIGINS`). Mint an API key as notify's README describes, then paste it into **Connect**.

To enroll a real device over USB, the device must reach the API: run notify with `--ip 0.0.0.0` and use your
computer's LAN address in the **Device URL** field (`ws://192.168.x.y:8787/api/devices/connect`).

### Cloudflare (Workers static assets)

```bash
# wrangler.jsonc: set account_id to yours (or delete it to use `wrangler login`), and the custom domain
VITE_NOTIFY_API_URL=https://notify.example.com pnpm run deploy
```

The Worker has no script: it serves `dist/` with SPA fallback. Then:

1. Add the console's origin to notify's `CONSOLE_ORIGINS` (`wrangler secret put` or vars in notify).
2. Put **Cloudflare Access** in front of the console's hostname (Zero Trust → Access → Applications) so only you
   can load it.

CI deploys on a `v*` tag (`.github/workflows/deploy.yml`) with the repo secrets `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` and the repo variable `NOTIFY_API_URL`.

### Docker

```bash
NOTIFY_API_URL=https://notify.example.com docker compose up -d     # http://localhost:8080
```

or the published image:

```bash
docker run -p 8080:8080 -e NOTIFY_API_URL=https://notify.example.com ghcr.io/abdallahaho/notify-console:latest
```

`NOTIFY_API_URL` is read at container start and written to `/config.json`, so one image fits any notify host. Add the
console's origin to notify's `CONSOLE_ORIGINS`.

### Which API URL wins

1. What you saved in **Connect** (this browser's localStorage).
2. `/config.json` `apiUrl` (Docker writes it from `NOTIFY_API_URL`).
3. `VITE_NOTIFY_API_URL` at build time.
4. `http://localhost:8787`.

## How it fits together

- **[notify](https://github.com/AbdallahAHO/notify)**: the API (Cloudflare Worker, D1, a Durable Object per device).
  The console's types are generated from its OpenAPI: `pnpm api:types <url-or-file>`.
- **[buddy-kit](https://github.com/AbdallahAHO/buddy-kit)**: the ESP32 firmware. Its `glance` app shows asks and
  answers them with a button. USB enrollment speaks its line-JSON protocol at 115200 baud (`status`, `wifi`,
  `notifylink`), and Improv Serial when the firmware answers it.

## Security

- **The API key** lives in your browser's localStorage and goes only to the configured API URL. Anything that runs on
  the console's origin could read it: host the console on its own origin, put an SSO proxy (Cloudflare Access) in
  front, use a key you can revoke, and **Forget key** on shared machines.
- **Device tokens** never reach the page: USB enrollment passes the token from the API response straight to the serial
  port. If the board refuses it, the console revokes the new destination so no unusable credential is left behind.
- **Webhook secrets** are shown once, held only in that form's state, and dropped when you confirm or leave.
- **Wi-Fi passwords** go over USB to the board only, never to the API.
- The console sets `X-Frame-Options: DENY`, `nosniff` and `no-referrer` (`public/_headers` on Cloudflare,
  `docker/nginx.conf` in Docker).

Found a vulnerability? Open a private security advisory on GitHub rather than an issue.

## Development

`pnpm test` (Vitest, React Testing Library, MSW with fixtures from the OpenAPI examples) · `pnpm typecheck` ·
`pnpm lint` · `pnpm build` · `pnpm api:types http://localhost:8787/openapi.json`. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT, see [LICENSE](LICENSE).
