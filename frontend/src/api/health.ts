import type { HealthResponse } from "../types/story";

function apiUrl(path: string): string {
  const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
  return `${base}${path}`;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(apiUrl("/api/health"));
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Health check failed (${res.status})`);
  }
  return body as HealthResponse;
}
