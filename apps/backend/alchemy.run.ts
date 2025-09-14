import alchemy from "alchemy";
import { Worker } from "alchemy/cloudflare";
import path from "node:path";

const app = await alchemy("backend");

export const backend = await Worker("worker", {
	name: "karishma-backend",
	cwd: path.join(import.meta.dirname),
	entrypoint: path.join(import.meta.dirname, "src", "index.ts"),
	// Additional bindings will be added here as needed
});

if (import.meta.main) {
	console.log({ url: backend.url });
}

await app.finalize();
