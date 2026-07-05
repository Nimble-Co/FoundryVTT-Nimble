# Integration tests (live Foundry V14)

Vitest tests that run **inside a live Foundry world** — real `game`, real `CONFIG`, real document classes and database round-trips. No mocks. This is the automated proof that the system works on Foundry V14 at runtime; the unit suite (happy-dom + mocks in `tests/mocks/`) only guards logic and proves nothing about Foundry itself.

**Local only — never CI.** The suite needs a running, licensed Foundry instance, so it is not part of `pnpm test`, `pnpm check`, or any pipeline. Treat it as a developer-run gate before merging risky changes.

## Prerequisites

1. **Foundry VTT V14** (14.364+) running and reachable — by default at `http://localhost:30000`.
2. **A world using the Nimble system**, with the system pointing at your worktree's build:
   ```sh
   pnpm worktree:setup "<path-to-FoundryVTT-Data>" --overwrite
   ```
   The default world id is `nimbledev`; override with `FOUNDRY_WORLD`.
3. **A GM user without a password** in that world. The default join user is `Gamemaster`; override with `FOUNDRY_TEST_USER`.
4. Playwright's Chromium: `pnpm exec playwright install chromium` (one-time).

The harness handles the rest: if Foundry is sitting on the **setup screen**, it launches `FOUNDRY_WORLD` automatically, then joins as `FOUNDRY_TEST_USER` and waits for `game.ready`.

## Running

```sh
pnpm test:integration
```

## Configuration

Set environment variables in `.env.local` at the repo root (loaded automatically, not committed):

| Variable | Default | Purpose |
|---|---|---|
| `FOUNDRY_URL` | `http://localhost:30000` | Where Foundry is running. Auto-detects Windows-vs-WSL 2 setups when unset. |
| `FOUNDRY_WORLD` | `nimbledev` | World id to launch if Foundry is on the setup screen. |
| `FOUNDRY_TEST_USER` | `Gamemaster` | Join-screen user name (must need no password). |
| `HEADLESS` | `true` | `false` shows the browser window. |
| `THROTTLE_CANVAS` | `false` | `true` drops canvas FPS; can speed up runs on machines where hardware acceleration misbehaves. |
| `LOG_FOUNDRY_MJS` | `false` | `true` also forwards console output originating inside `foundry.mjs`. |
| `LOG_NATIVE_MESSAGES` | `false` | `true` also forwards browser-native messages (WebGL noise etc.). |

## How it works

- [vitest.integration.config.mts](../../vitest.integration.config.mts) is a **second Vitest project** (`--config`), completely separate from the unit project in `vite.config.mts`.
- [pool.ts](./pool.ts) is a custom Vitest pool: it launches Playwright Chromium, joins the Foundry world, and starts a throwaway Vite dev server that serves this repo's files to the page via `/@fs/`.
- [tester.ts](./tester.ts) is imported into the Foundry page and exposes `window.__foundry_vitest__` — an in-page Vitest runner. Test files execute **in the page**, with the live Foundry globals, and results stream back to the terminal.
- Test files live here as `*.test.ts`. Import test APIs from `vitest` explicitly (no globals). Use the live `game`/`CONFIG`/document classes — do **not** import modules from `src/` (the system already runs from its built bundle; importing source would create parallel module instances). Small shared constants like `#system` are fine.
- Clean up world documents your test creates (`afterAll` + delete), so repeated runs stay deterministic.

## Provenance and adaptations

Ported from the `foundry-vtt-types` fork's runtime harness (`github:Fronix/foundry-vtt-types#v14.363.0`, `tests/{pool,tester}.ts`). Deliberate deviations:

- **Page errors are logged, not thrown.** The fork kills the run on any uncaught page error; Nimble's suite must keep running while known system errors exist (they're what the migration is fixing).
- **World auto-launch** from the setup screen (`FOUNDRY_WORLD`) — the fork requires the world to be already at `/join`.
- **Join user selected by label** with `FOUNDRY_TEST_USER` (default `Gamemaster`) — the fork hardcodes a `Test User`.
- **Trimmed dependencies**: `get-port`, `pathe`, `url-join`, `normalize-url`, `stacktrace-parser`, and `dotenv` are replaced with small inline equivalents / Node built-ins (`process.loadEnvFile`). Only `@vitest/runner` was added (pinned to the installed vitest version — keep them in lockstep when bumping vitest).
- **`tests/utils.ts` / `tests/database.ts` were not ported** — they are fixtures for the fork's own type-tests, not part of the harness.
- Headless viewport is 1440×900 (Foundry requires ≥1366×768).
