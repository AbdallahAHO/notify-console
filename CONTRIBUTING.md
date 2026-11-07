# Contributing

1. `pnpm install`, then `pnpm dev` with a local notify (see the README).
2. Make the change in the feature's folder (`src/features/<feature>/`); keep logic in plain functions next to the
   component and test it there.
3. Before a PR: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`. CI runs the same, plus
   `wrangler deploy --dry-run`.
4. Commits follow Conventional Commits (`feat:`, `fix:`, `docs:` …), lowercase, imperative, one change each.

## When notify's API changes

Run notify, then `pnpm api:types http://localhost:8787/openapi.json` (or a saved file). It rewrites
`src/api/openapi.json` and `src/api/schema.d.ts`; commit both. `pnpm typecheck` shows what the change broke, and the
fixtures in `src/test/fixtures.ts` follow the spec's examples.

## Tests

- Unit tests for the pure parts: ask validation and the live-list merge, tag and pairing-code parsing, serial framing
  and Improv packets, the USB enrollment sequence (against a fake serial port and the MSW API).
- Component tests render the whole app at a route (`renderApp` in `src/test/render.tsx`) against an in-memory notify
  (`src/test/server.ts`). Assert on what a person sees, by role and label.
- Never touch real hardware in tests: `src/test/fake-port.ts` plays a buddy-kit board.
