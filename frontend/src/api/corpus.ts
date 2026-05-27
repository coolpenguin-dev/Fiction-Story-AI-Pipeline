import type { CorpusListResponse } from "../types/story";

function apiUrl(path: string): string {
  const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
  return `${base}${path}`;
}

export async function fetchCorpus(): Promise<CorpusListResponse> {
  const res = await fetch(apiUrl("/api/corpus"));
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const detail = (body as { detail?: string }).detail;
    throw new Error(detail ?? `Corpus request failed (${res.status})`);
  }

  return body as CorpusListResponse;
}
