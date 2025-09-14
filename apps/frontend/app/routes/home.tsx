import type { Route } from "./+types/home";
import { Welcome } from "../welcome/welcome";

interface GreetingResponse {
  message: string;
  timestamp: string;
  source: string;
}

interface StatusResponse {
  status: string;
  timestamp: string;
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export async function loader({ context }: Route.LoaderArgs) {
  try {
    const backend = context.cloudflare.env.backend;
    
    // Fetch data from backend using service bindings
    const [greetingResponse, statusResponse] = await Promise.all([
      backend.fetch(new Request("https://backend/api/greeting?name=Karishma") as any),
      backend.fetch(new Request("https://backend/api/status") as any),
    ]);

    if (!greetingResponse.ok || !statusResponse.ok) {
      throw new Error("Backend request failed");
    }

    const greeting = await greetingResponse.json() as GreetingResponse;
    const status = await statusResponse.json() as StatusResponse;

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