import type { SessionStatus } from "../../shared/api-contract.ts";

type SessionPresentation = {
  badge: "success" | "warning" | "error";
  label: string;
  canSave: boolean;
};

export const sessionPresentation = {
  empty: { badge: "warning", label: "Signing in", canSave: false },
  starting: { badge: "warning", label: "Signing in", canSave: true },
  awaiting_login: { badge: "warning", label: "Signing in", canSave: true },
  ready: { badge: "success", label: "Ready", canSave: false },
  failed: { badge: "error", label: "Needs attention", canSave: false },
  expired: { badge: "error", label: "Needs attention", canSave: false },
} satisfies Record<SessionStatus, SessionPresentation>;
