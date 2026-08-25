/**
 * Karishma route map.
 *
 * Routing model (Cloudflare Vite plugin + static assets):
 * - `run_worker_first: ["/api/*"]` → these hit Hono first
 * - other navigations → asset worker / SPA not_found_handling
 * - Worker code can call `env.ASSETS.fetch` when it needs an asset response
 */
import { createAgentRouter } from "@flue/runtime/routing";
import { Hono } from "hono";
import { z } from "zod";
import { Teammate } from "./agents/teammate.ts";
import {
  BrowserSessions,
  browserSessionsStub,
  browserSessionPaths,
} from "./browser/sessions.ts";
import { SharedComputer, sharedComputerStub } from "./computer/shared-computer.ts";
import type {
  BrowserStatusResponse,
  CompleteHandoffResponse,
  DirectoryListing,
  PingResponse,
  StartHandoffResponse,
} from "./shared/api-contract.ts";
import { startHandoffInputSchema } from "./shared/api-contract.ts";

type Bindings = {
  SharedComputer: DurableObjectNamespace<SharedComputer>;
  BrowserSessions: DurableObjectNamespace<BrowserSessions>;
  FLUE_TEAMMATE_AGENT: DurableObjectNamespace<Cloudflare.TeammateAgentRpc>;
  BROWSER: Fetcher;
  LOADER: WorkerLoader;
  AI: Ai;
  AI_GATEWAY_ID?: string;
  ASSETS: Fetcher;
};

const app = new Hono<{ Bindings: Bindings }>();

const writeFileInputSchema = z.object({
  path: z.string().min(1),
  text: z.string(),
});

const execInputSchema = z.object({
  command: z.string().min(1),
  backend: z.enum(["container", "shell"]).optional(),
  cwd: z.string().optional(),
});

const conversationIdSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9-]*$/);

// ── health ──────────────────────────────────────────────────────────────────
app.get("/api/ping", (c) =>
  c.json(
    {
      ok: true,
      service: "karishma",
      gatewayId: c.env.AI_GATEWAY_ID ?? null,
    } satisfies PingResponse,
  ),
);

// ── roster (empty at first boot; client-owned names → conversation ids) ─────
app.get("/api/roster", (c) =>
  c.json({
    agents: [
      {
        id: "teammate",
        mount: "/api/agents/teammate",
        description:
          "Generic named teammate. Create bots in the UI; each name is a durable thread.",
      },
    ],
    computer: {
      id: "default",
      note: "One shared computer for all bots. Not a security boundary.",
    },
  }),
);

app.delete("/api/teammates/:conversationId", async (c) => {
  const parsed = conversationIdSchema.safeParse(c.req.param("conversationId"));
  if (!parsed.success) return c.json({ error: "invalid conversation id" }, 400);

  const conversationId = parsed.data;
  try {
    await c.env.FLUE_TEAMMATE_AGENT.getByName(conversationId).destroy();
    return c.json({ ok: true, conversationId });
  } catch (error) {
    if (error instanceof Error && /abort|destroyed/i.test(error.message)) {
      return c.json({ ok: true, conversationId });
    }
    return c.json(
      { error: error instanceof Error ? error.message : String(error) },
      500,
    );
  }
});

// ── shared computer FS helpers ──────────────────────────────────────────────
app.get("/api/computer/ls", async (c) => {
  const path = c.req.query("path") ?? "/workspace";
  const stub = sharedComputerStub(c.env);
  const entries = await stub.listDir(path);
  return c.json({ path, entries } satisfies DirectoryListing);
});

app.get("/api/computer/file", async (c) => {
  const path = c.req.query("path");
  if (!path) return c.json({ error: "path required" }, 400);
  const stub = sharedComputerStub(c.env);
  const text = await stub.readText(path);
  if (text === null) return c.json({ error: "not found", path }, 404);
  return c.json({ path, text });
});

app.put("/api/computer/file", async (c) => {
  const parsed = writeFileInputSchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) {
    return c.json({ error: "path and text required" }, 400);
  }
  const stub = sharedComputerStub(c.env);
  await stub.writeText(parsed.data.path, parsed.data.text);
  return c.json({ ok: true, path: parsed.data.path });
});

app.post("/api/computer/exec", async (c) => {
  const parsed = execInputSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "command required" }, 400);
  const stub = sharedComputerStub(c.env);
  const result = await stub.exec(parsed.data.command, {
    backend: parsed.data.backend,
    cwd: parsed.data.cwd,
  });
  return c.json(result);
});

// ── browser login handoff (Cloudflare Browser Run + storageState) ───────────
// Named sessions only. Sticky identity = Playwright storageState on shared FS.
app.get("/api/browser/status", async (c) => {
  const configured = Boolean(c.env.BROWSER);
  if (!configured) {
    return c.json(
      {
        configured: false,
        provider: "browser-run",
        sessions: [],
        paths: { root: browserSessionPaths.root },
        note: "BROWSER binding missing (see docs/browser-sessions.md).",
      } satisfies BrowserStatusResponse,
    );
  }
  try {
    const sessions = await browserSessionsStub(c.env).list();
    return c.json(
      {
        configured: true,
        provider: "browser-run",
        sessions,
        paths: { root: browserSessionPaths.root },
        note:
          "Sticky logins use Browser Run Live View and Playwright storageState on the shared computer filesystem.",
      } satisfies BrowserStatusResponse,
    );
  } catch (error) {
    return c.json(
      {
        configured: true,
        provider: "browser-run",
        sessions: [],
        paths: browserSessionPaths,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

app.get("/api/browser/session/:id", async (c) => {
  const session = await browserSessionsStub(c.env).get(c.req.param("id"));
  if (!session) return c.json({ error: "not found" }, 404);
  return c.json({
    session,
    paths: {
      meta: browserSessionPaths.meta(session.id),
      storageState: browserSessionPaths.storageState(session.id),
    },
  });
});

app.post("/api/browser/session", async (c) => {
  const parsed = startHandoffInputSchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) {
    return c.json(
      {
        error: "startUrl required",
        hint: 'Example: { "id": "work-mail", "label": "Work mail", "startUrl": "https://mail.example.com" }',
      },
      400,
    );
  }
  try {
    const session = await browserSessionsStub(c.env).startHandoff(parsed.data);
    return c.json(
      {
        ok: true,
        session,
        liveViewUrl: session.liveViewUrl ?? null,
        paths: {
          meta: browserSessionPaths.meta(session.id),
          storageState: browserSessionPaths.storageState(session.id),
        },
        message:
          session.status === "awaiting_login" && session.liveViewUrl
            ? "Open liveViewUrl, sign in, click Done in Browser Run Live View (or Mark complete here)."
            : session.status === "ready"
              ? "Session ready (storageState sticky)."
              : session.error
                ? session.error
                : `Status: ${session.status}`,
      } satisfies StartHandoffResponse,
    );
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : String(error) },
      400,
    );
  }
});

app.post("/api/browser/session/:id/complete", async (c) => {
  try {
    const session = await browserSessionsStub(c.env).completeHandoff(
      c.req.param("id"),
    );
    return c.json({ ok: true, session } satisfies CompleteHandoffResponse);
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : String(error) },
      400,
    );
  }
});

app.delete("/api/browser/session/:id", async (c) => {
  const result = await browserSessionsStub(c.env).clear(c.req.param("id"));
  return c.json(result);
});

// ── Flue agents ─────────────────────────────────────────────────────────────
app.route("/api/agents/teammate", createAgentRouter(Teammate));

// Requests routed to the Worker fall back to the SPA asset binding.
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
