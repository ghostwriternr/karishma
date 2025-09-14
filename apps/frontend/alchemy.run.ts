import alchemy from "alchemy";
import { ReactRouter } from "alchemy/cloudflare";
import { backend } from "backend/alchemy";
import path from "node:path";

const app = await alchemy("frontend");

export const frontend = await ReactRouter("website", {
  cwd: path.join(import.meta.dirname),
  bindings: {
    backend,
  },
});

console.log({
  url: frontend.url,
});

await app.finalize();
