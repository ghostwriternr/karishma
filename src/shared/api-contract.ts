import { z } from "zod";

export const sessionStatuses = [
  "empty",
  "starting",
  "awaiting_login",
  "ready",
  "failed",
  "expired",
] as const;

export type SessionStatus = (typeof sessionStatuses)[number];

export type SessionRecord = {
  id: string;
  label: string;
  startUrl: string;
  status: SessionStatus;
  browserSessionId?: string;
  liveViewUrl?: string;
  instructions?: string;
  error?: string;
  provider: "browser-run";
  createdAt: string;
  updatedAt: string;
  lastReadyAt?: string;
  hasStorageState: boolean;
};

export type StartHandoffInput = {
  id?: string;
  label?: string;
  startUrl: string;
  instructions?: string;
  timeoutMs?: number;
};

export const sessionRecordSchema: z.ZodType<SessionRecord> = z.object({
  id: z.string(),
  label: z.string(),
  startUrl: z.string(),
  status: z.enum(sessionStatuses),
  browserSessionId: z.string().optional(),
  liveViewUrl: z.string().optional(),
  instructions: z.string().optional(),
  error: z.string().optional(),
  provider: z.literal("browser-run"),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastReadyAt: z.string().optional(),
  hasStorageState: z.boolean(),
});

export const startHandoffInputSchema: z.ZodType<StartHandoffInput> = z.object({
  id: z.string().optional(),
  label: z.string().optional(),
  startUrl: z.string(),
  instructions: z.string().optional(),
  timeoutMs: z.number().optional(),
});

export type PingResponse = {
  ok: true;
  service: string;
  gatewayId: string | null;
};

export type DirectoryListing = {
  path: string;
  entries: string[];
};

export type BrowserStatusResponse = {
  configured: boolean;
  provider: "browser-run";
  sessions: SessionRecord[];
  paths: { root: string };
  note?: string;
};

export type StartHandoffResponse = {
  ok: true;
  session: SessionRecord;
  liveViewUrl: string | null;
  paths: { meta: string; storageState: string };
  message: string;
};

export type CompleteHandoffResponse = {
  ok: true;
  session: SessionRecord;
};

export type ClearSessionResponse = {
  ok: true;
  id: string;
  storageDeleted: boolean;
};

export type DeleteTeammateResponse = {
  ok: true;
  conversationId: string;
};
