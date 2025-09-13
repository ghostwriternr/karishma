import alchemy from "alchemy";
import { Worker } from "alchemy/cloudflare";
import { backend } from "backend/alchemy";
import path from "node:path";

const app = await alchemy("frontend");

export const frontend = await Worker("website", {
  name: "karishma-frontend",
  entrypoint: path.join(import.meta.dirname, "build", "server", "index.js"),
  bindings: {
    backend,
  },
});

console.log({
  url: frontend.url,
});

await app.finalize();