# Cloudflare Access

Authentication uses **Cloudflare Access**. The application does not maintain
its own OAuth integration or user table.

## Opt-in via Alchemy

`alchemy.run.ts` creates an Access application when both are set:

| Env var | Purpose |
| --- | --- |
| `ACCESS_EMAIL` | Email address allowed by the policy |
| `ACCESS_DOMAIN` | Hostname to protect (`app.example.com` or `karishma.<subdomain>.workers.dev`) |

```bash
export ACCESS_EMAIL="you@example.com"
export ACCESS_DOMAIN="karishma.<your-subdomain>.workers.dev"
bun alchemy deploy
```

After the first deploy without Access, copy the workers.dev host from the
stack output `url`, set `ACCESS_DOMAIN`, and redeploy.

## Custom domain

Point a hostname you own at the Worker (Alchemy `domain` prop on the Worker,
or dashboard DNS), then set `ACCESS_DOMAIN` to that hostname.

## Local dev

`bun run dev` does **not** enforce Access. Treat local as trusted loopback.
