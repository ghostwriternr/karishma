import type { Route } from "./+types/home";
import { Welcome } from "../welcome/welcome";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export async function loader({ context }: Route.LoaderArgs) {
  try {
    // Use RPC calls - Alchemy's recommended pattern for service-to-service communication
    // The backend binding provides direct access to RPC methods
    const backend = context.cloudflare.env.backend;

    // Call RPC methods directly - no URL parsing needed!
    const [greeting, status] = await Promise.all([
      backend.getGreeting("Karishma"),
      backend.getStatus(),
    ]);

    return {
      greeting,
      status,
      message: `${greeting.message} (Backend is ${status.status})`,
    };
  } catch (error) {
    console.error("Error in loader:", error);
    return {
      greeting: null,
      status: null,
      message: `Error connecting to backend: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <Welcome
      message={loaderData.message}
      greeting={loaderData.greeting}
      status={loaderData.status}
    />
  );
}
