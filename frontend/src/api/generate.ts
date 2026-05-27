import type {
  GenerateResponse,
  GenerationMode,
  OutlineDraft,
  RetrievedScene,
  StoryState,
} from "../types/story";

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

export async function generateFromOutline(
  mode: GenerationMode,
  options: {
    outline: OutlineDraft;
    storyTitle: string;
    storyId?: string | null;
    storyState?: StoryState | null;
    retrievedScenes?: RetrievedScene[];
    topK?: number;
  }
): Promise<GenerateResponse> {
  const res = await fetch(apiUrl("/api/generate"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode,
      storyTitle: options.storyTitle,
      storyId: options.storyId ?? null,
      premise: options.outline.premise,
      chapterOutline: options.outline.chapterOutline,
      sceneBeats: options.outline.sceneBeats,
      storyState: options.storyState ?? null,
      retrievedScenes: options.retrievedScenes ?? [],
      topK: options.topK ?? 5,
      excludeStoryId: options.storyId ?? null,
    }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(parseErrorBody(body, res.status));
  }

  return body as GenerateResponse;
}
