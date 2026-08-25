/**
 * Shared Computer Durable Object — one named instance ("default").
 *
 * Hosts a `@cloudflare/computer` Workspace with:
 *   - durable SQLite FS (source of truth on the DO)
 *   - CloudflareContainerBackend (full Linux + computerd)
 *   - WorkerShellBackend (fast just-bash) as a secondary path
 *
 * Bots are not security boundaries: every named Flue agent talks to the
 * same SharedComputer via DO RPC.
 */
import { DurableObject } from "cloudflare:workers";
import {
  type DurableObjectStorageLike,
  getWorkspace,
  type WorkspaceClient,
  type WorkspaceOptions,
  withWorkspace,
} from "@cloudflare/computer";
import {
  CloudflareContainerBackend,
  withWorkspaceContainer,
} from "@cloudflare/computer/backends/container";
import { WorkerShellBackend } from "@cloudflare/computer/backends/worker-shell";

export type SharedComputerEnv = {
  SharedComputer: DurableObjectNamespace<SharedComputer>;
  LOADER: WorkerLoader;
  AI: Ai;
};

type WorkspaceHost = {
  ctx: DurableObjectState;
  env: SharedComputerEnv;
};

const workspaceHosts = new WeakMap<object, WorkspaceHost>();

class SharedComputerBase extends withWorkspaceContainer(
  class extends DurableObject<SharedComputerEnv> {},
) {
  constructor(ctx: DurableObjectState, env: SharedComputerEnv) {
    super(ctx, env);
    workspaceHosts.set(this, { ctx, env });
  }

  readonly backend = new CloudflareContainerBackend({
    id: "container",
    container: () => this,
    workspace: {
      binding: "SharedComputer",
      id: this.ctx.id.toString(),
    },
    egress: { mode: "direct" },
  });
}

function workspaceOptions(self: InstanceType<typeof SharedComputerBase>): WorkspaceOptions {
  const host = workspaceHosts.get(self);
  if (!host) throw new Error("SharedComputer workspace host was not initialized");
  const { ctx, env } = host;
  // SAFETY: @cloudflare/computer only uses the SQL cursor's object-row surface;
  // Cloudflare's storage implements it but declares a narrower generic return.
  const storage = ctx.storage as DurableObjectStorageLike;
  return {
    storage,
    sessionId: ctx.id.toString(),
    backends: [
      self.backend,
      new WorkerShellBackend({
        id: "shell",
        loader: env.LOADER,
        workspace: {
          binding: "SharedComputer",
          id: ctx.id.toString(),
        },
        ctx,
      }),
    ],
  };
}

export class SharedComputer extends withWorkspace(SharedComputerBase, workspaceOptions) {
  override async fetch(request: Request): Promise<Response> {
    return this.backend.handleFetch(request);
  }

  /** Read a UTF-8 file from the durable FS. */
  async readText(path: string): Promise<string | null> {
    using ws = await getWorkspace(this);
    try {
      return await ws.fs.readFile(path, "utf8");
    } catch (error) {
      const code = error instanceof Error ? errorCode(error) : undefined;
      if (code === "ENOENT") return null;
      throw error;
    }
  }

  /** Write a UTF-8 file, creating parent directories as needed. */
  async writeText(path: string, contents: string): Promise<void> {
    using ws = await getWorkspace(this);
    const parent = path.slice(0, path.lastIndexOf("/")) || "/";
    if (parent !== "/") {
      await ws.fs.mkdir(parent, { recursive: true });
    }
    await ws.fs.writeFile(path, contents);
  }

  /** List directory entries (names only). */
  async listDir(path: string): Promise<string[]> {
    using ws = await getWorkspace(this);
    try {
      const entries = await ws.fs.readdir(path);
      return entries.map((e) => e.name);
    } catch (error) {
      const code = error instanceof Error ? errorCode(error) : undefined;
      if (code === "ENOENT") return [];
      throw error;
    }
  }

  /** Run a shell command against the workspace (defaults to container backend). */
  async exec(
    command: string,
    options?: { backend?: "container" | "shell"; cwd?: string },
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    using ws = await getWorkspace(this);
    using run = await ws.runtime.exec(command, {
      backend: options?.backend ?? "container",
      cwd: options?.cwd,
      encoding: "utf8",
    });
    return await run.result();
  }

  /** Expose the live client for advanced callers (tools, hydration). */
  async workspace(): Promise<WorkspaceClient> {
    return getWorkspace(this);
  }
}

function errorCode(error: Error): string | undefined {
  if (!("code" in error)) return undefined;
  return String(error.code);
}

/** Helper used from the Worker isolate to reach the shared instance. */
export function sharedComputerStub(
  env: Pick<SharedComputerEnv, "SharedComputer">,
): DurableObjectStub<SharedComputer> {
  return env.SharedComputer.getByName("default");
}
