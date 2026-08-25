# Models (AI Gateway + Workers AI + BYOK)

Karishma routes inference through **Cloudflare AI Gateway**. Default model
traffic uses the **Workers AI** binding (`env.AI`) so a fresh deploy needs no
provider API keys.

## Defaults

| Piece | Choice |
| --- | --- |
| Binding | `AI` (`Cloudflare.Workers.AI` / wrangler `ai.binding`) |
| Flue model id | `cloudflare/@cf/moonshotai/kimi-k2.6` (swap freely) |
| Gateway | Alchemy resource `KarishmaGateway` (`AI_GATEWAY_ID` plain var on the Worker) |

Flue’s Cloudflare provider auto-registers against the Workers AI binding and
the account **default** AI Gateway. Alchemy provisions a **named** gateway
(`KarishmaGateway`) for caching and logs under a stable id; applications can
point traffic at it explicitly.

### Point Flue at the named gateway

In `src/app.ts` (module top-level, before routes):

```ts
import { setProvider } from "@flue/runtime";
import { cloudflareBindingProvider } from "@flue/runtime/cloudflare/workers-ai";
import { env } from "cloudflare:workers";

setProvider(
  cloudflareBindingProvider({
    binding: env.AI,
    gateway: {
      id: env.AI_GATEWAY_ID, // from Alchemy
      cacheTtl: 60,
    },
  }),
);
```

## BYOK (bring your own key)

Workers AI provides the default model. You can select another provider or
model based on your workload.

1. Put provider secrets in Cloudflare (Wrangler or Secrets Store), e.g.:
   ```bash
   bunx wrangler secret put ANTHROPIC_API_KEY
   # or OPENAI_API_KEY, etc.
   ```
2. Change the agent model string, e.g. in `src/agents/teammate.ts`:
   ```ts
   useModel("anthropic/claude-sonnet-4-6");
   ```
3. Route the provider through **AI Gateway** (Unified Billing
   or provider credentials on the gateway) so logs/limits stay in one place.

See Cloudflare docs:

- [AI Gateway](https://developers.cloudflare.com/ai-gateway/)
- [Workers AI](https://developers.cloudflare.com/workers-ai/)
- [Flue models](https://flueframework.com/docs/guide/models/)
