/**
 * Non-HTTP Worker exports. Flue re-exports everything here from the
 * generated Worker entry (`virtual:flue/worker`).
 *
 * - WorkspaceServiceProxy / WorkspaceProxy: loopback classes required by
 *   `@cloudflare/computer` backends (shell + container egress).
 * - SharedComputer: the shared container-backed Workspace DO.
 */
export {
  WorkspaceProxy,
  WorkspaceServiceProxy,
} from "@cloudflare/computer";
export { SharedComputer } from "./computer/shared-computer.ts";
export { BrowserSessions } from "./browser/sessions.ts";
