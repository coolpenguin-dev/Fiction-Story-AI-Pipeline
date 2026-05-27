import type { StoryAnalysis, StoryState } from "../types/story";

/** Build a lightweight coherence snapshot from analysis (mirrors backend). */
export function buildStoryState(analysis: StoryAnalysis): StoryState {
  const patterns = (analysis.patterns ?? []).slice(0, 3).flatMap((p) => {
    const name = p.name?.trim();
    if (!name) return [];
    return [{ name, description: p.description?.trim() ?? "" }];
  });

  const relationships = (analysis.relationships ?? []).slice(0, 10).flatMap((row) => {
    const pair = row.pair?.trim();
    if (!pair) return [];
    return [
      {
        pair,
        chapterOrScene: row.chapterOrScene?.trim() ?? "",
        trust: String(row.trust ?? "").trim(),
        tension: String(row.tension ?? "").trim(),
        intimacy: String(row.intimacy ?? "").trim(),
        notes: row.notes?.trim() ?? "",
      },
    ];
  });

  const openThreads: string[] = [];
  const seen = new Set<string>();
  const tail = (analysis.scenes ?? []).slice(-5);
  for (const scene of [...tail].reverse()) {
    for (const thread of scene.openThreads ?? []) {
      const text = String(thread ?? "").trim();
      if (text && !seen.has(text)) {
        seen.add(text);
        openThreads.push(text);
      }
    }
  }

  const characters: string[] = [];
  for (const scene of (analysis.scenes ?? []).slice(-3)) {
    for (const char of scene.characters ?? []) {
      const name = String(char ?? "").trim();
      if (name && !characters.includes(name)) {
        characters.push(name);
      }
    }
  }

  return {
    patterns,
    relationships,
    openThreads: openThreads.slice(0, 8),
    characters: characters.slice(0, 8),
    sceneCount: analysis.scenes?.length ?? 0,
  };
}

export function hasStoryStateContent(state: StoryState | null | undefined): boolean {
  if (!state) return false;
  return (
    state.patterns.length > 0 ||
    state.relationships.length > 0 ||
    state.openThreads.length > 0 ||
    state.characters.length > 0 ||
    state.sceneCount > 0
  );
}
