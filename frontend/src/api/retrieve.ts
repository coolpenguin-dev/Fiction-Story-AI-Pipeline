import type { OutlineDraft, QueryFocus, RetrieveResponse } from "../types/story";

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
  options?: {
    topK?: number;
    storyId?: string | null;
    crossStory?: boolean;
    minScore?: number | null;
    queryFocus?: QueryFocus;
  }
): Promise<RetrieveResponse> {
  const crossStory = options?.crossStory ?? true;
  const storyId = options?.storyId ?? null;
  const minScore = options?.minScore ?? 0.4;

  const res = await fetch(apiUrl("/api/retrieve"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      premise: outline.premise,
      chapterOutline: outline.chapterOutline,
      sceneBeats: outline.sceneBeats,
      topK: options?.topK ?? 5,
      excludeStoryId: crossStory ? storyId : storyId,
      crossStory,
      minScore: minScore <= 0 ? 0 : minScore,
      queryFocus: options?.queryFocus ?? "full",
    }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(parseErrorBody(body, res.status));
  }

  return body as RetrieveResponse;
}

export function queryFocusForWorkflowStep(step: 1 | 2 | 3 | 4): QueryFocus {
  switch (step) {
    case 1:
      return "premise";
    case 2:
      return "chapter_outline";
    case 3:
      return "scene_beats";
    default:
      return "full";
  }
}
