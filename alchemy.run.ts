/**
 * Karishma infrastructure (Alchemy v2).
 *
 * Deploy path:
 *   1. `Command.Build` runs `bun run build` (single Vite build: client + Worker)
 *   2. Alchemy provisions AI Gateway (+ optional Access) and uploads the
 *      prebuilt Worker (bundle: false) with typed bindings.
 *
 * Local: `bun run dev` (Vite + Cloudflare plugin + Flue).
 * Deploy: `bun alchemy deploy`.
 */
import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Command from "alchemy/Command";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { BrowserSessions } from "./src/browser/sessions.ts";
import type { SharedComputer } from "./src/computer/shared-computer.ts";

/** Optional authorized email for Cloudflare Access (set ACCESS_EMAIL). */
const accessEmail = process.env.ACCESS_EMAIL?.trim();
/** Hostname to protect (e.g. karishma.<account>.workers.dev or app.example.com). */
const accessDomain = process.env.ACCESS_DOMAIN?.trim();

export default Alchemy.Stack(
  "Karishma",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), Command.providers()),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    // The build hash links Worker deployment to the Vite output. Alchemy runs
    // AppBuild before preparing a Worker whenever an input changes.
    const build = yield* Command.Build("AppBuild", {
      command: "bun run build",
      cwd: ".",
      outdir: "dist",
      memo: {
        include: [
          "src/**",
          "index.html",
          "container/**",
          "package.json",
          "bun.lock",
          "vite.config.ts",
          "wrangler.jsonc",
          "tsconfig.json",
          "alchemy.run.ts",
        ],
      },
    });

    const gateway = yield* Cloudflare.AI.Gateway("KarishmaGateway", {
      cacheTtl: 60,
      collectLogs: true,
    });

    const worker = yield* Cloudflare.Worker("Karishma", {
      name: "karishma",
      // Static paths identify the prebuilt bundle; assets.hash carries the
      // dependency on AppBuild because Alchemy attributes are Output proxies.
      main: "./dist/karishma/index.js",
      bundle: false,
      compatibility: {
        // Child-isolate experimental features are configured through Worker
        // Loader rather than the host Worker's compatibility flags.
        date: "2026-06-01",
        flags: ["nodejs_compat"],
      },
      // The Vite output hash makes the Worker asset resource depend on AppBuild.
      assets: {
        directory: "./dist/client",
        notFoundHandling: "single-page-application",
        runWorkerFirst: ["/api/*"],
        hash: build.hash.output,
      },
      env: {
        AI: Cloudflare.Workers.AI(),
        // Cloudflare Browser Run (sticky login via Live View + storageState).
        BROWSER: Cloudflare.Browser("BROWSER"),
        LOADER: Cloudflare.WorkerLoader("LOADER"),
        // Distinct resource and binding identifiers preserve both the Durable
        // Object namespace and container metadata in generated bindings. The
        // context directory supplies its default Dockerfile.
        SharedComputer: Cloudflare.Container<SharedComputer>(
          "SharedComputerApp",
          {
            className: "SharedComputer",
            context: `${import.meta.dirname}/container`,
            instanceType: "standard-1",
            maxInstances: 3,
          },
        ),
        // Binding name + class name match Flue's Vite output wrangler.json.
        FLUE_TEAMMATE_AGENT: Cloudflare.DurableObject("FLUE_TEAMMATE_AGENT", {
          className: "FlueTeammateAgent",
        }),
        // Sticky Browser Run login sessions (generic named profiles +
        // Playwright storageState on SharedComputer FS).
        BrowserSessions: Cloudflare.DurableObject<BrowserSessions>(
          "BrowserSessions",
          { className: "BrowserSessions" },
        ),
        // Plain text var — Flue/app can read which named gateway Alchemy owns.
        AI_GATEWAY_ID: gateway.gatewayId,
      },
    });

    if (accessEmail && accessDomain) {
      const policy = yield* Cloudflare.Access.Policy("KarishmaOperator", {
        name: "Karishma operator",
        decision: "allow",
        include: [{ email: { email: accessEmail } }],
      });
      const accessApp = yield* Cloudflare.Access.Application("KarishmaUi", {
        type: "self_hosted",
        domain: accessDomain,
        sessionDuration: "24h",
        policies: [policy.policyId],
      });
      return {
        url: worker.url,
        gatewayId: gateway.gatewayId,
        accessApplicationId: accessApp.applicationId,
        accessConfigured: true,
      };
    }

    return {
      url: worker.url,
      gatewayId: gateway.gatewayId,
      accessApplicationId: undefined,
      accessConfigured: false,
    };
  }),
);
