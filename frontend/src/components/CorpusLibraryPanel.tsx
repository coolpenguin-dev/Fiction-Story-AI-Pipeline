import { Database, Loader2, RefreshCw } from "lucide-react";
import type { CorpusListResponse, CorpusEntry } from "../types/story";

type Props = {
  corpus: CorpusListResponse | null;
  sessionCorpus: CorpusEntry[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
};

function sessionStoryIds(sessionCorpus: CorpusEntry[]): Set<string> {
  return new Set(
    sessionCorpus
      .map((e) => e.data.storyId)
      .filter((id): id is string => Boolean(id))
  );
}

export function CorpusLibraryPanel({
  corpus,
  sessionCorpus,
  loading,
  error,
  onRefresh,
}: Props) {
  const inSession = sessionStoryIds(sessionCorpus);
  const stories = corpus?.stories ?? [];
  const summary = corpus?.summary;
  const configured = corpus?.configured ?? false;

  return (
    <section className="rounded-2xl border border-ink-200/80 bg-white shadow-card overflow-hidden">
      <div className="border-b border-ink-100 bg-gradient-to-r from-ink-50 to-white px-6 py-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-950 flex items-center gap-2">
            <Database className="h-5 w-5 text-accent" />
            Stored corpus
          </h2>
          <p className="mt-1 text-sm text-ink-600">
            Stories indexed in Pinecone
            {corpus?.namespace ? (
              <>
                {" "}
                · namespace{" "}
                <code className="text-xs bg-ink-100 px-1 rounded">{corpus.namespace}</code>
              </>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </button>
      </div>

      <div className="p-6">
        {loading && !corpus && (
          <p className="text-sm text-ink-500 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading stored stories…
          </p>
        )}

        {error && (
          <p className="text-sm text-red-800 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            {error}
          </p>
        )}

        {!loading && !error && !configured && (
          <p className="text-sm text-ink-600">
            Pinecone is not configured. Stories will appear here after you analyze PDFs with
            vector storage enabled.
          </p>
        )}

        {corpus?.error && configured && (
          <p className="text-sm text-red-800 rounded-lg border border-red-200 bg-red-50 px-4 py-3 mb-4">
            {corpus.error}
          </p>
        )}

        {corpus?.warning && (
          <p className="text-sm text-amber-900 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mb-4">
            {corpus.warning}
          </p>
        )}

        {corpus?.dedupe &&
          (corpus.dedupe.removedStoryGroups > 0 || corpus.dedupe.removedVectors > 0) && (
            <p className="text-sm text-emerald-900 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 mb-4">
              Removed {corpus.dedupe.removedStoryGroups} duplicate story group
              {corpus.dedupe.removedStoryGroups === 1 ? "" : "s"} (
              {corpus.dedupe.removedVectors} orphan vectors).
            </p>
          )}

        {configured && !corpus?.error && stories.length === 0 && !loading && (
          <p className="text-sm text-ink-600">
            No stories in Pinecone yet. Upload and analyze 1–5 PDFs to build your POC corpus.
          </p>
        )}

        {stories.length > 0 && (
          <>
            {summary && (
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-3">
                {summary.storyCount} {summary.storyCount === 1 ? "story" : "stories"} ·{" "}
                {summary.totalScenes} scenes · {summary.totalVectors} vectors
              </p>
            )}

            <div className="overflow-x-auto rounded-xl border border-ink-200">
              <table className="min-w-full text-sm">
                <thead className="bg-ink-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Story ID</th>
                    <th className="px-4 py-3">Source file</th>
                    <th className="px-4 py-3 text-right">Scenes</th>
                    <th className="px-4 py-3">Mode</th>
                    <th className="px-4 py-3">Session</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {stories.map((story) => {
                    const active = inSession.has(story.storyId);
                    return (
                      <tr key={story.storyId} className="bg-white hover:bg-ink-50/50">
                        <td className="px-4 py-3 font-medium text-ink-900 max-w-[10rem] truncate">
                          {story.storyTitle}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-ink-700">
                          {story.storyId}
                        </td>
                        <td className="px-4 py-3 text-ink-600 max-w-[10rem] truncate">
                          {story.sourceFileName ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-ink-800">
                          {story.sceneCount}
                        </td>
                        <td className="px-4 py-3 text-ink-600 text-xs">
                          {story.analysisMode === "linear_choice_1"
                            ? "Choice 1"
                            : story.analysisMode === "full_branching"
                              ? "Branching"
                              : story.analysisMode ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          {active ? (
                            <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                              Loaded
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-600">
                              Stored only
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-xs text-ink-500">
              Stored-only stories have scene vectors for retrieval. Re-upload the PDF to view
              scenes, patterns, and outlines in this session.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
