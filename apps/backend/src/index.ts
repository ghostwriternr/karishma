import { WorkerEntrypoint } from "cloudflare:workers";
import type { backend } from "../alchemy.run";

export default class BackendWorker extends WorkerEntrypoint<
	typeof backend.Env
> {
	// RPC methods that can be called directly
	async getGreeting(name: string) {
		return {
			message: `Hello ${name}!`,
			timestamp: new Date().toISOString(),
			source: "Karishma Backend API",
		};
	}

	async getStatus() {
		return {
			status: "running",
			service: "karishma-backend",
			version: "1.0.0",
			timestamp: new Date().toISOString(),
		};
	}
}
