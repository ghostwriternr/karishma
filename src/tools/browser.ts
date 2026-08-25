/**
 * Flue tools that drive Cloudflare Browser Run sticky sessions.
 * The teammate agent controls navigation through these tools.
 */
import { defineTool } from "@flue/runtime";
import { env } from "cloudflare:workers";
import * as v from "valibot";
import {
  browserSessionsStub,
  type DriveResult,
  type SessionRecord,
} from "../browser/sessions.ts";

interface SessionsRpc {
  list(): Promise<SessionRecord[]>;
  drive(input: { id: string; url?: string }): Promise<DriveResult>;
}

function sessions(): SessionsRpc {
  return browserSessionsStub(env);
}

export const listBrowserSessions = defineTool({
  name: "list_browser_sessions",
  description:
    "List sticky browser login sessions (Cloudflare Browser Run + storageState). " +
    "Use before browsing sites that require a saved login.",
  async run() {
    const list = await sessions().list();
    return JSON.stringify(
      list.map((s) => ({
        id: s.id,
        label: s.label,
        status: s.status,
        startUrl: s.startUrl,
        ready: s.status === "ready" && s.hasStorageState,
        hasStorageState: s.hasStorageState,
        error: s.error ?? null,
      })),
    );
  },
});

export const browseSession = defineTool({
  name: "browse_session",
  description:
    "Open a sticky Browser Run session after login handoff. Loads Playwright storageState, " +
    "navigates to a URL, returns title + text preview, and re-saves cookies. " +
    "The site must accept automated cloud browsers.",
  input: v.object({
    sessionId: v.pipe(
      v.string(),
      v.description("Session id from list_browser_sessions / login handoff"),
    ),
    url: v.optional(
      v.pipe(v.string(), v.description("URL to open; defaults to the session startUrl")),
    ),
  }),
  async run({ data }) {
    const result = await sessions().drive({
      id: data.sessionId,
      url: data.url,
    });
    return JSON.stringify({
      sessionId: result.sessionId,
      url: result.url,
      title: result.title,
      textPreview: result.text ?? null,
    });
  },
});
