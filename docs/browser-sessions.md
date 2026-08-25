# Browser sessions (Cloudflare Browser Run)

Karishma keeps **generic** sticky browser logins on **Cloudflare Browser Run**.
Callers pass their own `id` + `startUrl`. Sticky identity is Playwright
**`storageState`** on the shared computer FS (cookies + localStorage + indexedDB).

The teammate agent drives Browser Run + Playwright through the
`browse_session` Flue tool.

## Site compatibility

Browser Run traffic is **identified as automation**, including Live View HITL.
Sites that restrict automated browsers may block login or navigation. A saved
session can only retain a login that the site accepts in Browser Run.

Use Browser Run for:

- Sites that accept cloud Chromium
- Human login handoff through Live View
- Agent page open / text extract under a saved `storageState`

## Flow

1. Browser Run binding `BROWSER` is declared in `wrangler.jsonc` / Alchemy (no API key).
2. `POST /api/browser/session` with `{ id?, label?, startUrl, instructions? }`.
3. Worker launches Playwright via `@cloudflare/playwright`, navigates to `startUrl`,
   loads any existing `storage-state.json`, then:
   - `Cloudflare.getLiveView` (`mode: "tab"`)
   - `Cloudflare.handoff` (structured HITL)
4. The user opens **Live View**, signs in, and clicks **Done** (or **Mark complete** in the UI).
5. Worker snapshots `context.storageState({ indexedDB: true })` to:

```text
/workspace/browser/<id>/meta.json
/workspace/browser/<id>/storage-state.json
```

6. Flue tools reopen a new Browser Run session with that `storageState`.

Sessions are **not** security boundaries between bots.

## Secrets / env

| Name | Required | Purpose |
| --- | --- | --- |
| `BROWSER` binding | yes | Cloudflare Browser Run (Alchemy `Cloudflare.Browser()`) |

Browser Run is configured through the Worker binding and does not require a
separate API credential.

Local: Browser Run works through the Workers binding (Vite + workerd). Deploy:
Alchemy attaches `BROWSER` automatically.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/browser/status` | List sessions + config health |
| `GET` | `/api/browser/session/:id` | One session |
| `POST` | `/api/browser/session` | Start handoff |
| `POST` | `/api/browser/session/:id/complete` | Mark ready (UI path) |
| `DELETE` | `/api/browser/session/:id` | Drop storageState + meta |

## Flue tools

| Tool | Purpose |
| --- | --- |
| `list_browser_sessions` | Ready / pending sessions |
| `browse_session` | Open URL under sticky storageState; return title + text |

## Limits

- `keep_alive` max **10 minutes** per Browser Run session
- Concurrent browser sessions are account-limited — close after handoff/drive
- Sticky login only helps **after** a site accepts the first login once
