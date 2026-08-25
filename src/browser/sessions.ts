/**
 * BrowserSessions — Durable Object for sticky Cloudflare Browser Run logins.
 *
 * Generic named sessions (any label + start URL). Human signs in via Browser Run
 * Live View + structured HITL (`Cloudflare.handoff`). Sticky identity is Playwright
 * `storageState` on the shared Computer FS. Site compatibility depends on whether
 * the site accepts automated cloud browsers.
 *
 * Path convention:
 *   /workspace/browser/<sessionId>/meta.json
 *   /workspace/browser/<sessionId>/storage-state.json
 */
import { DurableObject } from "cloudflare:workers";
import { launch } from "@cloudflare/playwright";
import type {
  BrowserContext,
  HandoffCompleteResponse,
} from "@cloudflare/playwright";
import { sharedComputerStub, type SharedComputer } from "../computer/shared-computer.ts";
import type {
  SessionRecord,
  StartHandoffInput,
} from "../shared/api-contract.ts";
import { sessionRecordSchema } from "../shared/api-contract.ts";

export type { SessionRecord, SessionStatus, StartHandoffInput } from "../shared/api-contract.ts";

export type BrowserSessionsEnv = {
  BROWSER: Fetcher;
  SharedComputer: DurableObjectNamespace<SharedComputer>;
  BrowserSessions: DurableObjectNamespace<BrowserSessions>;
};

export type DriveResult = {
  sessionId: string;
  browserSessionId: string;
  url: string;
  title: string;
  text?: string;
};

const DEFAULT_HANDOFF_TIMEOUT_MS = 900_000;
const KEEP_ALIVE_MS = 600_000; // Browser Run max keep_alive (10m)
const STORAGE_DIR = "/workspace/browser";
const STATUS_POLL_MS = 500;

function metaPath(id: string): string {
  return `${STORAGE_DIR}/${id}/meta.json`;
}

function storageStatePath(id: string): string {
  return `${STORAGE_DIR}/${id}/storage-state.json`;
}

export function slugSessionId(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return s || "session";
}

function defaultIdFromUrl(startUrl: string): string {
  try {
    const host = new URL(startUrl).hostname.replace(/^www\./, "");
    return slugSessionId(host);
  } catch {
    return slugSessionId(startUrl);
  }
}

type HandoffJob = {
  id: string;
  browserSessionId: string;
  deadline: number;
};

type StorageState = Awaited<ReturnType<BrowserContext["storageState"]>>;

export class BrowserSessions extends DurableObject<BrowserSessionsEnv> {
  #jobs = new Map<string, AbortController>();

  private computer() {
    return sharedComputerStub(this.env);
  }

  private now(): string {
    return new Date().toISOString();
  }

  private async readMeta(id: string): Promise<SessionRecord | null> {
    const text = await this.computer().readText(metaPath(id));
    if (!text) return null;
    try {
      const parsed = sessionRecordSchema.safeParse(JSON.parse(text));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  private async writeMeta(record: SessionRecord): Promise<void> {
    record.updatedAt = this.now();
    record.provider = "browser-run";
    record.hasStorageState = await this.#hasStorageState(record.id);
    await this.computer().writeText(metaPath(record.id), JSON.stringify(record, null, 2));
  }

  async #hasStorageState(id: string): Promise<boolean> {
    const text = await this.computer().readText(storageStatePath(id));
    return Boolean(text?.trim());
  }

  async #readStorageState(id: string): Promise<StorageState | undefined> {
    const text = await this.computer().readText(storageStatePath(id));
    if (!text?.trim()) return undefined;
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  }

  async #writeStorageState(id: string, state: StorageState): Promise<void> {
    await this.computer().writeText(storageStatePath(id), JSON.stringify(state, null, 2));
  }

  async list(): Promise<SessionRecord[]> {
    const names = await this.computer().listDir(STORAGE_DIR);
    const out: SessionRecord[] = [];
    for (const name of names) {
      const meta = await this.readMeta(name);
      if (meta) {
        meta.hasStorageState = await this.#hasStorageState(meta.id);
        out.push(meta);
      }
    }
    out.sort((a, b) => a.id.localeCompare(b.id));
    return out;
  }

  async get(id: string): Promise<SessionRecord | null> {
    const clean = slugSessionId(id);
    const meta = await this.readMeta(clean);
    if (!meta) return null;
    meta.hasStorageState = await this.#hasStorageState(clean);
    return meta;
  }

  /**
   * Start a login handoff: Browser Run session + Live View + structured HITL.
   * Returns once liveViewUrl is available; finishes when the user clicks Done
   * (or Complete in UI / timeout), then persists Playwright storageState.
   */
  async startHandoff(input: StartHandoffInput): Promise<SessionRecord> {
    if (!this.env.BROWSER) {
      throw new Error("BROWSER binding missing — enable Browser Run in wrangler / Alchemy");
    }
    const startUrl = input.startUrl?.trim();
    if (!startUrl) throw new Error("startUrl required");
    let parsed: URL;
    try {
      parsed = new URL(startUrl);
    } catch {
      throw new Error("startUrl must be an absolute URL");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("startUrl must be http(s)");
    }

    const id = slugSessionId(input.id ?? input.label ?? defaultIdFromUrl(startUrl));
    const label = (input.label?.trim() || id).slice(0, 80);
    const instructions =
      input.instructions?.trim() ||
      `Sign in for session "${label}". When finished, click Done in Browser Run Live View (or Mark complete here).`;
    const timeoutMs = Math.min(
      Math.max(input.timeoutMs ?? DEFAULT_HANDOFF_TIMEOUT_MS, 60_000),
      1_800_000,
    );

    this.#jobs.get(id)?.abort();
    this.#jobs.delete(id);

    const existing = await this.readMeta(id);
    const record: SessionRecord = {
      id,
      label,
      startUrl,
      status: "starting",
      instructions,
      provider: "browser-run",
      createdAt: existing?.createdAt ?? this.now(),
      updatedAt: this.now(),
      lastReadyAt: existing?.lastReadyAt,
      hasStorageState: await this.#hasStorageState(id),
      error: undefined,
      liveViewUrl: undefined,
      browserSessionId: undefined,
    };
    await this.writeMeta(record);

    const abort = new AbortController();
    this.#jobs.set(id, abort);
    this.ctx.waitUntil(this.#runHandoff(record, timeoutMs, abort.signal));

    const spinDeadline = Date.now() + 90_000;
    while (Date.now() < spinDeadline) {
      const latest = await this.readMeta(id);
      if (!latest) {
        await scheduler.wait(STATUS_POLL_MS);
        continue;
      }
      if (latest.status === "failed") {
        latest.hasStorageState = await this.#hasStorageState(id);
        return latest;
      }
      if (
        latest.liveViewUrl &&
        (latest.status === "awaiting_login" || latest.status === "ready")
      ) {
        latest.hasStorageState = await this.#hasStorageState(id);
        return latest;
      }
      if (latest.status === "ready") {
        latest.hasStorageState = await this.#hasStorageState(id);
        return latest;
      }
      await scheduler.wait(STATUS_POLL_MS);
    }

    const latest = (await this.readMeta(id)) ?? record;
    latest.hasStorageState = await this.#hasStorageState(id);
    if (latest.status === "starting" && !latest.error) {
      latest.error =
        "handoff still starting when the API wait budget ended; poll GET /api/browser/session/:id";
    }
    return latest;
  }

  async #runHandoff(
    seed: SessionRecord,
    timeoutMs: number,
    signal: AbortSignal,
  ): Promise<void> {
    const id = seed.id;
    let browser: Awaited<ReturnType<typeof launch>> | undefined;

    const patch = async (partial: Partial<SessionRecord>) => {
      const cur = (await this.readMeta(id)) ?? seed;
      const next: SessionRecord = {
        ...cur,
        ...partial,
        id,
        provider: "browser-run",
        updatedAt: this.now(),
      };
      next.hasStorageState = await this.#hasStorageState(id);
      await this.writeMeta(next);
      return next;
    };

    try {
      if (signal.aborted) return;

      const existingState = await this.#readStorageState(id);
      browser = await launch(this.env.BROWSER, { keep_alive: KEEP_ALIVE_MS });
      const browserSessionId = browser.sessionId();
      const context = await browser.newContext(
        existingState ? { storageState: existingState } : undefined,
      );
      const page = await context.newPage();
      try {
        await page.goto(seed.startUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
      } catch (navError) {
        console.warn(
          "goto failed during handoff",
          navError instanceof Error ? navError.message : navError,
        );
      }

      if (signal.aborted) {
        await browser.close().catch(() => {});
        return;
      }

      const cdp = await context.newCDPSession(page);
      const { devtoolsFrontendUrl } = await cdp.send("Cloudflare.getLiveView", {
        mode: "tab",
        expiresInMs: Math.min(timeoutMs, 3_600_000),
      });

      if (!devtoolsFrontendUrl) {
        await patch({
          status: "failed",
          error: "Cloudflare.getLiveView returned no URL",
          browserSessionId,
        });
        await browser.close().catch(() => {});
        return;
      }

      await patch({
        status: "awaiting_login",
        liveViewUrl: devtoolsFrontendUrl,
        browserSessionId,
        error: undefined,
      });

      const deadline = Date.now() + timeoutMs;
      await this.ctx.storage.put<HandoffJob>("job:" + id, {
        id,
        browserSessionId,
        deadline,
      });
      await this.ctx.storage.setAlarm(deadline + 15_000);

      // The user can finish through Live View "Done" or the app's Mark complete action.
      // Race both; #completeFlag is set by completeHandoff RPC.
      const handoffCompletePromise = new Promise<HandoffCompleteResponse>((resolve) => {
        // SAFETY: @cloudflare/playwright augments CDP commands but omits this
        // documented Cloudflare event from CDPSession's event overloads.
        const listen = cdp.once.bind(cdp) as (
          event: "Cloudflare.handoffComplete",
          listener: (response: HandoffCompleteResponse) => void,
        ) => void;
        listen("Cloudflare.handoffComplete", resolve);
      });

      await cdp.send("Cloudflare.handoff", {
        instructions: seed.instructions ?? `Sign in for "${seed.label}"`,
        timeout: timeoutMs,
      });

      let outcome: "done" | "failed" | "timeout" | "aborted" | "ui_complete" = "timeout";
      let failReason: string | undefined;

      while (!signal.aborted && Date.now() < deadline) {
        const ui = await this.ctx.storage.get<boolean>("complete:" + id);
        if (ui) {
          outcome = "ui_complete";
          break;
        }
        const raced = await Promise.race([
          handoffCompletePromise.then((r) => ({ kind: "hitl" as const, r })),
          scheduler.wait(STATUS_POLL_MS).then(() => ({ kind: "tick" as const })),
        ]);
        if (raced.kind === "hitl") {
          if (raced.r.success) outcome = "done";
          else {
            outcome = "failed";
            failReason = raced.r.reason ?? "handoff marked failed in Live View";
          }
          break;
        }
      }

      if (signal.aborted) {
        outcome = "aborted";
      }

      if (outcome === "aborted") {
        await browser.close().catch(() => {});
        return;
      }

      if (outcome === "failed") {
        await patch({
          status: "failed",
          error: failReason ?? "handoff failed",
          liveViewUrl: undefined,
          browserSessionId: undefined,
        });
        await browser.close().catch(() => {});
        return;
      }

      if (outcome === "timeout") {
        // Persist whatever cookies we have if any login happened; else fail soft.
        try {
          const state = await context.storageState({ indexedDB: true });
          await this.#writeStorageState(id, state);
          await patch({
            status: "ready",
            liveViewUrl: undefined,
            browserSessionId: undefined,
            lastReadyAt: this.now(),
            error: "handoff wait budget ended; storageState saved from current session",
            hasStorageState: true,
          });
        } catch {
          await patch({
            status: "failed",
            error: "handoff timed out before storageState could be saved",
            liveViewUrl: undefined,
            browserSessionId: undefined,
          });
        }
        await browser.close().catch(() => {});
        return;
      }

      // done | ui_complete
      const state = await context.storageState({ indexedDB: true });
      await this.#writeStorageState(id, state);
      await patch({
        status: "ready",
        liveViewUrl: undefined,
        browserSessionId: undefined,
        lastReadyAt: this.now(),
        error: undefined,
        hasStorageState: true,
      });
      await browser.close().catch(() => {});
    } catch (error) {
      if (signal.aborted) return;
      await browser?.close().catch(() => {});
      await patch({
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        liveViewUrl: undefined,
        browserSessionId: undefined,
      });
    } finally {
      this.#jobs.delete(id);
      try {
        await this.ctx.storage.delete("job:" + id);
        await this.ctx.storage.delete("complete:" + id);
      } catch {
        /* ignore */
      }
    }
  }

  /**
   * Drive a ready session under Flue tool control.
   * Loads storageState, opens a short-lived Browser Run session, navigates,
   * returns page text, and re-persists storageState.
   */
  async drive(input: {
    id: string;
    url?: string;
  }): Promise<DriveResult> {
    if (!this.env.BROWSER) {
      throw new Error("BROWSER binding missing");
    }
    const id = slugSessionId(input.id);
    const meta = await this.get(id);
    if (!meta) {
      throw new Error(`session "${id}" not found — run login handoff first`);
    }
    const storageState = await this.#readStorageState(id);
    if (!storageState) {
      throw new Error(
        `session "${id}" has no storageState — run login handoff and Mark complete first`,
      );
    }

    const browser = await launch(this.env.BROWSER, { keep_alive: KEEP_ALIVE_MS });
    try {
      const context = await browser.newContext({ storageState });
      const page = await context.newPage();
      const targetUrl = input.url?.trim() || meta.startUrl;
      await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });

      const url = page.url();
      const title = await page.title();
      let text: string | undefined;
      try {
        text = await page.evaluate(
          () => (document.body?.innerText || "").slice(0, 8000),
        );
      } catch {
        /* ignore */
      }

      const nextState = await context.storageState({ indexedDB: true });
      await this.#writeStorageState(id, nextState);
      await this.writeMeta({
        ...meta,
        status: "ready",
        lastReadyAt: this.now(),
        updatedAt: this.now(),
        hasStorageState: true,
        error: undefined,
        provider: "browser-run",
      });

      return {
        sessionId: id,
        browserSessionId: browser.sessionId(),
        url,
        title,
        text,
      };
    } finally {
      await browser.close().catch(() => {});
    }
  }

  async clear(id: string): Promise<{
    ok: true;
    id: string;
    storageDeleted: boolean;
  }> {
    const clean = slugSessionId(id);
    this.#jobs.get(clean)?.abort();
    this.#jobs.delete(clean);
    await this.ctx.storage.delete("job:" + clean).catch(() => {});
    await this.ctx.storage.delete("complete:" + clean).catch(() => {});

    await this.computer().exec(`rm -rf ${JSON.stringify(STORAGE_DIR + "/" + clean)}`, {
      backend: "shell",
    });
    return { ok: true, id: clean, storageDeleted: true };
  }

  /**
   * Mark handoff complete from the UI (parallel to Live View "Done").
   * Signals the in-flight handoff loop to snapshot storageState.
   */
  async completeHandoff(id: string): Promise<SessionRecord> {
    const clean = slugSessionId(id);
    const meta = await this.get(clean);
    if (!meta) throw new Error(`session ${clean} not found`);
    if (meta.status === "ready" && meta.hasStorageState) {
      return meta;
    }
    if (meta.status !== "awaiting_login" && meta.status !== "starting") {
      throw new Error(
        `session ${clean} is ${meta.status} — start a handoff before Mark complete`,
      );
    }

    await this.ctx.storage.put("complete:" + clean, true);

    // Wait for #runHandoff to observe the flag and persist storageState.
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      const latest = await this.readMeta(clean);
      if (latest?.status === "ready" && (await this.#hasStorageState(clean))) {
        latest.hasStorageState = true;
        return latest;
      }
      if (latest?.status === "failed") {
        latest.hasStorageState = await this.#hasStorageState(clean);
        return latest;
      }
      await scheduler.wait(STATUS_POLL_MS);
    }

    const latest = (await this.get(clean)) ?? meta;
    if (latest.status !== "ready") {
      throw new Error(
        `session ${clean} did not reach ready after Mark complete — is Live View still open?`,
      );
    }
    return latest;
  }

  override async alarm(): Promise<void> {
    const list = await this.list();
    for (const s of list) {
      if (s.status !== "awaiting_login" && s.status !== "starting") continue;
      const job = await this.ctx.storage.get<HandoffJob>("job:" + s.id);
      if (!job) continue;
      if (Date.now() < job.deadline) continue;
      // Signal complete so an in-flight loop can snapshot; otherwise mark expired.
      await this.ctx.storage.put("complete:" + s.id, true);
      await scheduler.wait(5_000);
      const after = await this.readMeta(s.id);
      if (after && after.status !== "ready" && after.status !== "failed") {
        await this.writeMeta({
          ...after,
          status: after.hasStorageState ? "ready" : "failed",
          error: after.hasStorageState
            ? "handoff alarm fired; using existing storageState"
            : "handoff timed out (alarm)",
          liveViewUrl: undefined,
          browserSessionId: undefined,
          lastReadyAt: after.hasStorageState ? this.now() : after.lastReadyAt,
          provider: "browser-run",
        });
      }
      await this.ctx.storage.delete("job:" + s.id);
      await this.ctx.storage.delete("complete:" + s.id);
    }
  }
}

export function browserSessionsStub(
  env: Pick<BrowserSessionsEnv, "BrowserSessions">,
): DurableObjectStub<BrowserSessions> {
  return env.BrowserSessions.getByName("default");
}

export const browserSessionPaths = {
  root: STORAGE_DIR,
  meta: metaPath,
  storageState: storageStatePath,
};
