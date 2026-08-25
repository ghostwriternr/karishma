import { cloudflare } from "@cloudflare/vite-plugin";
import { flue, flueWorkerConfig } from "@flue/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Official Cloudflare Vite SPA+API shape (workers-sdk playground/spa-with-api,
 * docs workers/vite-plugin/tutorial):
 *   plugins: [react(), cloudflare()]
 * plus Flue ahead of cloudflare so flueWorkerConfig() can inject agent DOs.
 *
 * Do NOT set assets.directory in wrangler input config — the Vite plugin
 * populates it from the client environment build output automatically.
 * assets.binding / not_found_handling / run_worker_first stay in wrangler.
 */
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    flue(),
    cloudflare({ config: flueWorkerConfig() }),
  ],
  worker: {
    format: "es",
  },
});
