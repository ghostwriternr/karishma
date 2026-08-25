import { z } from "zod";
import {
  sessionRecordSchema,
  type BrowserStatusResponse,
  type ClearSessionResponse,
  type CompleteHandoffResponse,
  type DirectoryListing,
  type StartHandoffInput,
  type StartHandoffResponse,
} from "../../shared/api-contract.ts";

const directoryListingSchema: z.ZodType<DirectoryListing> = z.object({
  path: z.string(),
  entries: z.array(z.string()),
});

const browserStatusSchema: z.ZodType<BrowserStatusResponse> = z.object({
  configured: z.boolean(),
  provider: z.literal("browser-run"),
  sessions: z.array(sessionRecordSchema),
  paths: z.object({ root: z.string() }),
  note: z.string().optional(),
});

const startHandoffSchema: z.ZodType<StartHandoffResponse> = z.object({
  ok: z.literal(true),
  session: sessionRecordSchema,
  liveViewUrl: z.string().nullable(),
  paths: z.object({ meta: z.string(), storageState: z.string() }),
  message: z.string(),
});

const completeHandoffSchema: z.ZodType<CompleteHandoffResponse> = z.object({
  ok: z.literal(true),
  session: sessionRecordSchema,
});

const clearSessionSchema: z.ZodType<ClearSessionResponse> = z.object({
  ok: z.literal(true),
  id: z.string(),
  storageDeleted: z.boolean(),
});

const errorResponseSchema = z.object({ error: z.string() });

async function request<T>(
  path: string,
  init: RequestInit | undefined,
  schema: z.ZodType<T>,
): Promise<T> {
  const response = await fetch(path, init);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const errorBody = errorResponseSchema.safeParse(body);
    const message = errorBody.success ? errorBody.data.error : response.statusText;
    throw new Error(message || `Request failed (${response.status})`);
  }
  const result = schema.safeParse(body);
  if (!result.success) throw new Error(`Invalid response from ${path}`);
  return result.data;
}

export async function listDirectory(
  path: string,
  signal?: AbortSignal,
): Promise<DirectoryListing> {
  const endpoint = `/api/computer/ls?path=${encodeURIComponent(path)}`;
  return request(endpoint, { signal }, directoryListingSchema);
}

export async function listSignIns(signal?: AbortSignal): Promise<BrowserStatusResponse> {
  const path = "/api/browser/status";
  return request(path, { signal }, browserStatusSchema);
}

export async function startSignIn(input: StartHandoffInput): Promise<StartHandoffResponse> {
  const path = "/api/browser/session";
  return request(
    path,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
    startHandoffSchema,
  );
}

export async function completeSignIn(id: string): Promise<CompleteHandoffResponse> {
  const path = `/api/browser/session/${encodeURIComponent(id)}/complete`;
  return request(path, { method: "POST" }, completeHandoffSchema);
}

export async function removeSignIn(id: string): Promise<ClearSessionResponse> {
  const path = `/api/browser/session/${encodeURIComponent(id)}`;
  return request(path, { method: "DELETE" }, clearSessionSchema);
}
