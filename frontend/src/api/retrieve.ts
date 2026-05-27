import type { OutlineDraft, RetrieveResponse } from "../types/story";

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

export async function retrieveSimilarScenes(
  outline: OutlineDraft,
  options?: { topK?: number; excludeStoryId?: string | null }
): Promise<RetrieveResponse> {
  const res = await fetch(apiUrl("/api/retrieve"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      premise: outline.premise,
      chapterOutline: outline.chapterOutline,
      sceneBeats: outline.sceneBeats,
      topK: options?.topK ?? 5,
      excludeStoryId: options?.excludeStoryId ?? null,
    }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(parseErrorBody(body, res.status));
  }

  return body as RetrieveResponse;
}
