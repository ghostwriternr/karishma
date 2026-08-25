export async function checkService(signal: AbortSignal): Promise<void> {
  const response = await fetch("/api/ping", { signal });
  if (!response.ok) throw new Error(response.statusText || "Service unavailable");
}
