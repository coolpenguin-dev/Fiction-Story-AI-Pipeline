import { AlertCircle, CheckCircle2, CloudOff, Loader2 } from "lucide-react";
import type { HealthResponse } from "../types/story";

type Props = {
  health: HealthResponse | null;
  loading: boolean;
  error: string | null;
  /** Authoritative count from /api/corpus when health stats lag behind. */
  corpusVectorCount?: number | null;
};

export function IngestionStatusBanner({
  health,
  loading,
  error,
  corpusVectorCount,
}: Props) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-ink-50/80 px-4 py-3 text-sm text-ink-600">
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        Checking server storage configuration…
      </div>
    );
  }

  if (error || !health) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          Could not reach the backend health check. Analysis may still work if the API is up.
          {error ? ` (${error})` : ""}
        </p>
      </div>
    );
  }

  const pinecone = health.pinecone;
  const openaiOk = health.openai.configured;
  const vectorCount =
    corpusVectorCount != null ? corpusVectorCount : pinecone.vectorCount;

  if (pinecone.configured && pinecone.reachable) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
        <div>
          <p className="font-medium">Pinecone ready</p>
          <p className="mt-0.5 text-emerald-800/90">
            Vectors save to namespace{" "}
            <code className="text-xs bg-emerald-100/80 px-1 rounded">{pinecone.namespace}</code>
            {vectorCount != null && (
              <> · {vectorCount} vector{vectorCount !== 1 ? "s" : ""} in corpus</>
            )}
            . Re-uploading the same PDF replaces that story&apos;s vectors.
          </p>
          {!openaiOk && (
            <p className="mt-1 text-xs text-emerald-800/80">
              OpenAI key not set on server — enter your key below for analysis.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (pinecone.configured && !pinecone.reachable) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-900">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">Pinecone configured but unreachable</p>
          <p className="mt-0.5">{pinecone.error ?? "Check index host, API key, and network."}</p>
          <p className="mt-1 text-xs">Analysis will run; vectors will not save until this is fixed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
      <CloudOff className="h-4 w-4 shrink-0 mt-0.5" />
      <div>
        <p className="font-medium">Pinecone not configured on server</p>
        <p className="mt-0.5">
          {pinecone.error ??
            "Set PINECONE_API_KEY and PINECONE_INDEX_NAME in backend/.env. Analysis works; vectors won't be stored."}
        </p>
      </div>
    </div>
  );
}
