import type { TabId, StoryAnalysis } from "../types/story";

export const SESSION_STORAGE_KEY = "fiction-rag-session";
const LEGACY_OUTLINE_KEY = "fiction-rag-outline";

export type PersistedSession = {
  data: StoryAnalysis;
  outline: StoryAnalysis["outline"];
  activeTab: TabId;
  fileName?: string;
  fileSize?: number;
  savedAt: string;
};

export function loadSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSession;
    if (!parsed?.data?.storyTitle) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: Omit<PersistedSession, "savedAt">): void {
  try {
    const payload: PersistedSession = {
      ...session,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota exceeded or private mode */
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(LEGACY_OUTLINE_KEY);
}
