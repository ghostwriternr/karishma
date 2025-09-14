/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);

		// Simple routing
		if (url.pathname === "/api/greeting") {
			const name = url.searchParams.get("name") || "World";
			return new Response(
				JSON.stringify({
					message: `Hello ${name}!`,
					timestamp: new Date().toISOString(),
					source: "Karishma Backend API",
				}),
				{
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		if (url.pathname === "/api/status") {
			return new Response(
				JSON.stringify({
					status: "running",
					service: "karishma-backend",
					version: "1.0.0",
				}),
				{
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Default response
		return new Response(
			"Karishma Backend API - Try /api/greeting or /api/status",
		);
	},
} satisfies ExportedHandler<Env>;
