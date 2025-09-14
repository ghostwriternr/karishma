import alchemy from "alchemy";
import { ReactRouter } from "alchemy/cloudflare";
import { backend } from "backend/alchemy";

const app = await alchemy("frontend");

export const frontend = await ReactRouter("website", {
  bindings: {
    backend,
  },
});

console.log({
  url: frontend.url,
});

await app.finalize();
