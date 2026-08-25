import type { BrowserSessions } from "./browser/sessions.ts";
import type { SharedComputer } from "./computer/shared-computer.ts";

declare global {
  namespace Cloudflare {
    interface TeammateAgentRpc extends Rpc.DurableObjectBranded {
      destroy(): Promise<void>;
    }

    interface Env {
      LOADER: WorkerLoader;
      AI: Ai;
      SharedComputer: DurableObjectNamespace<SharedComputer>;
      BrowserSessions: DurableObjectNamespace<BrowserSessions>;
      FLUE_TEAMMATE_AGENT: DurableObjectNamespace<TeammateAgentRpc>;
      BROWSER: Fetcher;
      AI_GATEWAY_ID?: string;
      ASSETS: Fetcher;
    }
  }
}
