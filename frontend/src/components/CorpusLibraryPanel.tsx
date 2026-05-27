import {
  BookMarked,
  Database,
  FileText,
  Loader2,
  RefreshCw,
} from "lucide-react";
import type { CorpusEntry, CorpusListResponse } from "../types/story";

type Props = {
  corpus: CorpusListResponse | null;
  sessionStories?: CorpusEntry[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
};

function truncateId(id: string, max = 28): string {
  if (id.length <= max) return id;
  return `${id.slice(0, max - 1)}…`;
}

export function CorpusLibraryPanel({
  corpus,
  sessionStories = [],
  loading,
  error,
  onRefresh,
}: Props) {
  const sessionIds = new Set(
    sessionStories.map((s) => s.data.storyId).filter(Boolean) as string[]
  );

  const stories = corpus?.stories ?? [];
  const summary = corpus?.summary;
  const configured = corpus?.configured ?? false;

  return (
    <section className="rounded-2xl border border-ink-200/80 bg-white shadow-card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-ink-100 bg-gradient-to-r from-ink-50/80 to-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-950 text-white">
            <Database className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-ink-950">
              Corpus library
            </h2>
            <p className="text-xs text-ink-500 mt-0.5">
              Stories stored in Pinecone · used for cross-manuscript retrieval
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh library
        </button>
      </div>

      {summary && configured && (
        <div className="grid grid-cols-3 divide-x divide-ink-100 border-b border-ink-100 bg-ink-50/30">
          <div className="px-4 py-3 text-center sm:px-5">
            <p className="text-lg font-semibold tabular-nums text-ink-950">
              {summary.storyCount}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
              Stories
            </p>
          </div>
          <div className="px-4 py-3 text-center sm:px-5">
            <p className="text-lg font-semibold tabular-nums text-ink-950">
              {summary.totalScenes}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
              Scenes
            </p>
          </div>
          <div className="px-4 py-3 text-center sm:px-5">
            <p className="text-lg font-semibold tabular-nums text-ink-950">
              {summary.totalVectors}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
              Vectors
            </p>
          </div>
        </div>
      )}

      <div className="p-5">
        {error && (
          <p className="text-xs text-red-900 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 mb-4">
            {error}
          </p>
        )}

        {!configured && !loading && (
          <p className="text-sm text-ink-600 text-center py-8">
            Pinecone is not configured. Set{" "}
            <span className="font-mono text-xs">PINECONE_API_KEY</span> and{" "}
            <span className="font-mono text-xs">PINECONE_INDEX_NAME</span> in{" "}
            <span className="font-mono text-xs">backend/.env</span>, then analyze a PDF.
          </p>
        )}

        {loading && stories.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-ink-400" />
            <p className="mt-3 text-sm text-ink-500">Loading corpus…</p>
          </div>
        )}

        {!loading && configured && stories.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <BookMarked className="h-8 w-8 text-ink-300" />
            <p className="mt-3 text-sm font-medium text-ink-700">No stories in Pinecone yet</p>
            <p className="mt-1 text-xs text-ink-500 max-w-sm">
              Upload and analyze 1–5 PDFs to build your retrieval corpus.
            </p>
          </div>
        )}

        {stories.length > 0 && (
          <ul className="space-y-3">
            {stories.map((story) => {
              const inSession = sessionIds.has(story.storyId);
              return (
                <li
                  key={story.storyId}
                  className={`rounded-xl border p-4 transition-colors ${
                    inSession
                      ? "border-accent/30 bg-accent/5"
                      : "border-ink-200/80 bg-ink-50/20 hover:border-ink-300/80"
                  }`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display font-semibold text-sm text-ink-950 truncate">
                          {story.storyTitle}
                        </h3>
                        {inSession && (
                          <span className="badge bg-accent-light text-accent">In session</span>
                        )}
                        {story.analysisMode === "linear_choice_1" && (
                          <span className="badge bg-ink-100 text-ink-600">Choice 1</span>
                        )}
                      </div>
                      {story.sourceFileName && (
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-500 truncate">
                          <FileText className="h-3 w-3 shrink-0" />
                          {story.sourceFileName}
                        </p>
                      )}
                      <p
                        className="mt-1 text-[11px] font-mono text-ink-400 truncate"
                        title={story.storyId}
                      >
                        {truncateId(story.storyId)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums text-ink-900">
                        {story.sceneCount}
                      </p>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                        scene{story.sceneCount === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {corpus?.dedupe &&
          ((corpus.dedupe.removedStoryGroups ?? 0) > 0 ||
            (corpus.dedupe.removedVectors ?? 0) > 0) && (
            <p className="mt-4 text-[11px] text-ink-500">
              Auto-deduped {corpus.dedupe.removedStoryGroups ?? 0} duplicate story group
              {(corpus.dedupe.removedStoryGroups ?? 0) === 1 ? "" : "s"} (
              {corpus.dedupe.removedVectors ?? 0} vectors removed).
            </p>
          )}

        {corpus?.warning && (
          <p className="mt-4 text-[11px] text-amber-800 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            {corpus.warning}
          </p>
        )}

        {corpus?.error && !error && (
          <p className="mt-4 text-[11px] text-amber-800">{corpus.error}</p>
        )}
      </div>
    </section>
  );
}
