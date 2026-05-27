import type { CorpusEntry, GenerationDraft, TabId } from "../types/story";
import { EMPTY_GENERATION, EMPTY_WORKFLOW } from "../types/story";
import { buildStoryState } from "./storyState";

export const SESSION_STORAGE_KEY = "fiction-rag-session";
const LEGACY_OUTLINE_KEY = "fiction-rag-outline";

/** @deprecated single-story session shape */
type LegacyPersistedSession = {
  data: CorpusEntry["data"];
  outline: CorpusEntry["outline"];
  activeTab: TabId;
  fileName?: string;
  fileSize?: number;
  savedAt: string;
};

export type PersistedSession = {
  corpus: CorpusEntry[];
  selectedIndex: number;
  activeTab: TabId;
  savedAt: string;
};

function normalizeEntry(entry: CorpusEntry): CorpusEntry {
  const legacyGen = entry.generation as (GenerationDraft & { chapterBeats?: string }) | undefined;
  const storyState =
    entry.storyState ?? entry.data.storyState ?? buildStoryState(entry.data);
  return {
    ...entry,
    data: { ...entry.data, storyState },
    generation: {
      openingDraft: legacyGen?.openingDraft ?? "",
    },
    workflow: entry.workflow ?? { ...EMPTY_WORKFLOW },
    storyState,
  };
}

export function loadSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSession | LegacyPersistedSession;

    if (Array.isArray((parsed as PersistedSession).corpus)) {
      const session = parsed as PersistedSession;
      if (session.corpus.length === 0) return null;
      return {
        ...session,
        corpus: session.corpus.map(normalizeEntry),
      };
    }

    const legacy = parsed as LegacyPersistedSession;
    if (!legacy?.data?.storyTitle) return null;
    return {
      corpus: [
        normalizeEntry({
          fileName: legacy.fileName ?? legacy.data.storyTitle,
          fileSize: legacy.fileSize,
          data: legacy.data,
          outline: legacy.outline ?? legacy.data.outline,
          generation: { ...EMPTY_GENERATION },
          workflow: { ...EMPTY_WORKFLOW },
          storyState: buildStoryState(legacy.data),
        }),
      ],
      selectedIndex: 0,
      activeTab: legacy.activeTab ?? "scenes",
      savedAt: legacy.savedAt ?? new Date().toISOString(),
    };
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
