"use agent";
/**
 * Generic named teammate agent.
 *
 * The roster starts empty. Users create bots in the UI by choosing a
 * name; each conversation id is a durable thread on this agent class.
 * All bots share one SharedComputer DO (not a security boundary).
 *
 * Browser: Cloudflare Browser Run sticky storageState + Flue drive tools.
 */
import { env } from "cloudflare:workers";
import { useModel, useSandbox, useTool } from "@flue/runtime";
import { getComputerSandbox } from "../sandboxes/cloudflare-computer.ts";
import { browseSession, listBrowserSessions } from "../tools/browser.ts";

export { workspaceHost as cloudflare } from "../sandboxes/cloudflare-computer.ts";

export function Teammate() {
  const { LOADER } = env;

  useModel("cloudflare/@cf/moonshotai/kimi-k2.6");

  useSandbox(getComputerSandbox({ loader: LOADER }));

  useTool(listBrowserSessions);
  useTool(browseSession);

  return [
    "You are a durable named teammate on Karishma.",
    "You share one cloud computer with every other bot on this account — bots are not security boundaries.",
    "Write lasting notes and artifacts under /workspace when the work should be available to other teammates.",
    "Browser logins are sticky Cloudflare Browser Run sessions (Playwright storageState on the shared computer).",
    "The user completes login handoff in the UI through Browser Run Live View.",
    "Use list_browser_sessions to see ready sessions, then browse_session to open pages as that login.",
    "Browser Run is an automated cloud browser, so site compatibility varies.",
    "If a session is missing or expired, ask the user to repeat the login handoff.",
    "Keep replies concise unless the user asks for depth.",
  ].join(" ");
}
