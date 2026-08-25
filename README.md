# Karishma

Karishma is a self-hosted workspace for persistent, named AI teammates. Each
teammate has a durable chat thread, and every teammate can work with the same
cloud filesystem, container, and saved browser sign-ins.

Karishma runs on **Cloudflare** and is designed for people who want an AI team
they can deploy, inspect, and adapt to their own workflows.

## Stack

| Layer | Choice |
| --- | --- |
| Agents / threads | [Flue](https://flueframework.com) on Cloudflare (Vite + Agents SDK DOs) |
| Infra as code | [Alchemy](https://alchemy.run/cloudflare/) v2 (`alchemy.run.ts`) |
| Shared computer | [`@cloudflare/computer`](https://www.npmjs.com/package/@cloudflare/computer) — SQLite FS + container (`computerd`) + worker-shell |
| Browser | [Cloudflare Browser Run](https://developers.cloudflare.com/browser-run/) Live View HITL + Playwright `storageState` ([docs](./docs/browser-sessions.md)) |
| Models | AI Gateway + Workers AI default; [BYOK docs](./docs/models.md) |
| Auth | Cloudflare Access ([docs](./docs/access.md)) |
| License | Apache-2.0 |

**Bots are not security boundaries.** Every named bot shares one Computer DO.

## Prerequisites

- Bun 1.3+
- Docker (container computer image build / deploy)
- Cloudflare account with Workers, Browser Run, Containers, and Worker Loader access
- Worker Loader beta access (worker-shell backend)

## Quick start

```bash
bun install
cp .env.example .env
# Set CLOUDFLARE_ACCOUNT_ID in .env

# Local (workerd via Cloudflare Vite plugin)
bun run dev

# Production deploy (build + Alchemy plan/apply)
bun alchemy login          # first time
bun run deploy             # or: bun alchemy deploy
```

Stack outputs include `url` and `gatewayId`.

Optional Access:

```bash
export ACCESS_EMAIL="you@example.com"
export ACCESS_DOMAIN="karishma.<subdomain>.workers.dev"
bun run deploy
```

## Layout

```text
alchemy.run.ts          # Alchemy stack (Gateway, Worker upload, Access)
wrangler.jsonc          # Flue/Vite Worker config (migrations, containers, assets)
vite.config.ts          # Flue + @cloudflare/vite-plugin
src/app.ts              # Hono routes + agent mounts
src/agents/teammate.ts  # Generic named-bot agent (empty roster)
src/computer/           # SharedComputer DO (@cloudflare/computer)
src/browser/            # BrowserSessions DO (Browser Run handoff)
src/tools/              # Flue tools (browse_session via Playwright)
src/sandboxes/          # Flue cloudflare-computer adapter
src/client/             # React SPA (roster + chat + FS + sign-in handoff)
container/Dockerfile    # computerd image
docs/                   # models, Access, browser sessions
```

## Scripts

| Script | What |
| --- | --- |
| `bun run dev` | Vite dev (React client + Flue Worker, one process) |
| `bun run build` | Client + Worker production bundles |
| `bun run deploy` | `alchemy deploy` (runs build via `Command.Build`) |
| `bun run plan` | Alchemy dry-run |
| `bun run typecheck` | `tsc --noEmit` |
