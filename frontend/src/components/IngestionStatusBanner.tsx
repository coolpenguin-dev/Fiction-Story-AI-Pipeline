import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import type { CorpusListResponse, HealthResponse } from "../types/story";

type Props = {
  health: HealthResponse | null;
  corpus: CorpusListResponse | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
};

function displayVectorCount(
  health: HealthResponse | null,
  corpus: CorpusListResponse | null
): number | null {
  const corpusCount = corpus?.summary?.totalVectors;
  if (typeof corpusCount === "number" && corpusCount > 0) return corpusCount;
  const healthCount = health?.pinecone?.vectorCount;
  if (typeof healthCount === "number" && healthCount > 0) return healthCount;
  if (typeof corpusCount === "number") return corpusCount;
  if (typeof healthCount === "number") return healthCount;
  return null;
}

export function IngestionStatusBanner({
  health,
  corpus,
  loading,
  error,
  onRefresh,
}: Props) {
  const openaiOk = health?.openai?.configured ?? false;
  const pineconeConfigured = health?.pinecone?.configured ?? false;
  const pineconeReachable = health?.pinecone?.reachable ?? false;
  const vectorCount = displayVectorCount(health, corpus);
  const storyCount = corpus?.summary?.storyCount ?? 0;
  const namespace = health?.pinecone?.namespace ?? corpus?.namespace;

  const allReady = openaiOk && (!pineconeConfigured || pineconeReachable);
  const statusLabel = allReady ? "Ready" : "Needs attention";

  return (
    <section
      className={`rounded-xl border px-4 py-3 sm:px-5 ${
        allReady && !error
          ? "border-emerald-200/80 bg-emerald-50/60"
          : "border-amber-200/80 bg-amber-50/50"
      }`}
      aria-live="polite"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              allReady && !error ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
            }`}
          >
            {allReady && !error ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-semibold text-ink-900">{statusLabel}</span>
              <span className="text-xs text-ink-500">· ingestion pipeline</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-600">
              <span className="inline-flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-ink-400" />
                OpenAI {openaiOk ? "configured" : "missing key"}
              </span>
              <span className="inline-flex items-center gap-1">
                <Cloud className="h-3 w-3 text-ink-400" />
                Pinecone{" "}
                {!pineconeConfigured
                  ? "not configured"
                  : pineconeReachable
                    ? "connected"
                    : "unreachable"}
              </span>
              {namespace && (
                <span className="text-ink-500">
                  ns <span className="font-mono">{namespace}</span>
                </span>
              )}
              {vectorCount != null && (
                <span>
                  {vectorCount} vector{vectorCount === 1 ? "" : "s"}
                  {storyCount > 0 ? ` · ${storyCount} ${storyCount === 1 ? "story" : "stories"}` : ""}
                </span>
              )}
            </div>
            {error && <p className="mt-1.5 text-xs text-red-800">{error}</p>}
            {!error && health?.openai?.note && (
              <p className="mt-1.5 text-xs text-amber-900">{health.openai.note}</p>
            )}
            {!error && health?.pinecone?.error && pineconeConfigured && (
              <p className="mt-1.5 text-xs text-amber-900">{health.pinecone.error}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh status
        </button>
      </div>
    </section>
  );
}
