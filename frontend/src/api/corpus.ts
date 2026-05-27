import type { CorpusListResponse, HealthResponse } from "../types/story";

function apiUrl(path: string): string {
  const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
  return `${base}${path}`;
}

function parseErrorBody(body: unknown, status: number): string {
  const detail = (body as { detail?: unknown })?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => (d as { msg?: string }).msg).join(", ");
  }
  return `Request failed (${status})`;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(apiUrl("/api/health"));
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseErrorBody(body, res.status));
  }
  return body as HealthResponse;
}

export async function fetchCorpus(): Promise<CorpusListResponse> {
  const res = await fetch(apiUrl("/api/corpus"));
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseErrorBody(body, res.status));
  }
  return body as CorpusListResponse;
}
