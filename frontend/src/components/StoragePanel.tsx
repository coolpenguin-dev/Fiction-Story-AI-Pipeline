import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  Database,
  Layers,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import type { PineconeInfo, StoryAnalysis } from "../types/story";

const STORED_METADATA = [
  "story_id",
  "story_title",
  "source_filename",
  "scene_id",
  "chapter",
  "path_id",
  "is_choice_point",
  "characters",
  "setting",
  "pov",
  "tone",
  "analysis_mode",
];

const EMBEDDED_FIELDS = [
  "Scene title",
  "Setting & POV",
  "Characters",
  "Plot beat",
  "Conflict",
  "Relationship beats",
  "Tone",
  "Open threads",
];

type Props = {
  data: StoryAnalysis;
};

function storageState(pinecone: PineconeInfo | undefined, sceneCount: number) {
  const status = pinecone?.status;
  const configured = pinecone?.configured;
  const upserted = pinecone?.upserted ?? 0;
  const expected = pinecone?.expected ?? sceneCount;

  if (status === "error") {
    return { kind: "error" as const, upserted, expected, hasError: true };
  }

  if (status === "ok" && upserted > 0) {
    return {
      kind: "saved" as const,
      upserted,
      expected,
      hasError: false,
    };
  }

  if (status === "partial" && upserted > 0) {
    return {
      kind: "partial" as const,
      upserted,
      expected,
      hasError: false,
    };
  }

  if (status === "skipped" && configured === false) {
    return { kind: "not_configured" as const, upserted, expected, hasError: false };
  }

  if (status === "skipped") {
    return { kind: "skipped" as const, upserted, expected, hasError: false };
  }

  if (pinecone?.error) {
    return { kind: "error" as const, upserted, expected, hasError: true };
  }

  return { kind: "unknown" as const, upserted, expected, hasError: false };
}

export function StoragePanel({ data }: Props) {
  const sceneCount = data.scenes?.length ?? 0;
  const pinecone = data.pinecone;
  const state = storageState(pinecone, sceneCount);

  const borderClass =
    state.kind === "error"
      ? "border-red-200 bg-red-50/80"
      : state.kind === "saved"
        ? "border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white"
        : state.kind === "partial"
          ? "border-amber-200 bg-gradient-to-br from-amber-50/60 to-white"
          : "border-amber-200 bg-gradient-to-br from-amber-50/60 to-white";

  return (
    <div className="space-y-6">
      <div className={`rounded-xl border p-6 shadow-card ${borderClass}`}>
        <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-ink-950">
          {state.kind === "error" ? (
            <AlertCircle className="h-5 w-5 text-red-600" />
          ) : state.kind === "saved" ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          ) : state.kind === "partial" ? (
            <AlertCircle className="h-5 w-5 text-amber-600" />
          ) : (
            <Cloud className="h-5 w-5 text-amber-600" />
          )}
          Pinecone storage
        </h3>

        {state.kind === "error" && (
          <p className="mt-3 text-sm text-red-800 leading-relaxed">
            <span className="font-medium">Could not save vectors.</span>{" "}
            {pinecone?.error}
          </p>
        )}

        {state.kind === "saved" && (
          <p className="mt-3 text-sm text-ink-800 leading-relaxed">
            <span className="font-medium text-emerald-800">Saved successfully.</span>{" "}
            {state.upserted} scene{state.upserted !== 1 ? "s" : ""} embedded and upserted
            {pinecone?.replaced && (
              <>
                {" "}
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <RefreshCw className="h-3.5 w-3.5" />
                  (replaced prior vectors for this file)
                </span>
              </>
            )}
            .
          </p>
        )}

        {state.kind === "partial" && (
          <p className="mt-3 text-sm text-amber-900 leading-relaxed">
            <span className="font-medium">Partial save.</span>{" "}
            {pinecone?.error ??
              `Stored ${state.upserted} of ${state.expected} scenes.`}
          </p>
        )}

        {state.kind === "not_configured" && (
          <p className="mt-3 text-sm text-ink-700 leading-relaxed">
            <span className="font-medium">Storage skipped — Pinecone not configured.</span>{" "}
            Set{" "}
            <code className="text-xs bg-ink-100 px-1 py-0.5 rounded">PINECONE_API_KEY</code> and{" "}
            <code className="text-xs bg-ink-100 px-1 py-0.5 rounded">PINECONE_INDEX_NAME</code>{" "}
            on the server, then analyze again.
          </p>
        )}

        {state.kind === "skipped" && (
          <p className="mt-3 text-sm text-ink-700 leading-relaxed">
            Vectors were not stored for this run.{" "}
            {pinecone?.error ?? "Persistence was disabled."}
          </p>
        )}

        {state.kind === "unknown" && (
          <p className="mt-3 text-sm text-ink-700 leading-relaxed">
            No storage result returned. Check server logs and run Analyze again with Pinecone
            configured.
          </p>
        )}

        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-white/70 border border-ink-100 px-4 py-3">
            <dt className="field-label">Story ID</dt>
            <dd className="mt-1 text-sm font-mono text-ink-900 break-all">
              {data.storyId || "—"}
            </dd>
            <p className="mt-1 text-xs text-ink-500">Stable slug from PDF filename</p>
          </div>
          <div className="rounded-lg bg-white/70 border border-ink-100 px-4 py-3">
            <dt className="field-label">Source file</dt>
            <dd className="mt-1 text-sm text-ink-900 break-all">
              {data.sourceFileName || "—"}
            </dd>
          </div>
          <div className="rounded-lg bg-white/70 border border-ink-100 px-4 py-3">
            <dt className="field-label">Namespace</dt>
            <dd className="mt-1 text-sm text-ink-900">
              {pinecone?.namespace || "fiction (default)"}
            </dd>
          </div>
          <div className="rounded-lg bg-white/70 border border-ink-100 px-4 py-3">
            <dt className="field-label">Status</dt>
            <dd className="mt-1 text-sm text-ink-900 capitalize">
              {pinecone?.status ?? "—"}
              {pinecone?.configured === false && " · not configured"}
            </dd>
          </div>
          <div className="rounded-lg bg-white/70 border border-ink-100 px-4 py-3 sm:col-span-2">
            <dt className="field-label">Vectors upserted</dt>
            <dd className="mt-1 text-sm text-ink-900">
              {state.kind === "error" && state.upserted === 0
                ? `0 / ${state.expected} scenes`
                : `${state.upserted} / ${state.expected} scenes`}
            </dd>
          </div>
          <div className="rounded-lg bg-white/70 border border-ink-100 px-4 py-3 sm:col-span-2">
            <dt className="field-label">Chunk level</dt>
            <dd className="mt-1 text-sm text-ink-900">One vector per scene</dd>
          </div>
        </dl>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-ink-200/80 bg-white p-5 shadow-card">
          <h4 className="flex items-center gap-2 font-display font-semibold text-ink-950">
            <Layers className="h-4 w-4 text-accent" />
            Metadata stored
          </h4>
          <p className="mt-1 text-xs text-ink-500">
            Fixed schema — same for every story (used to filter retrieval).
          </p>
          <ul className="mt-3 space-y-2">
            {STORED_METADATA.map((field) => (
              <li
                key={field}
                className="flex items-start gap-2 text-sm text-ink-700"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <code className="text-xs">{field}</code>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-ink-200/80 bg-white p-5 shadow-card">
          <h4 className="flex items-center gap-2 font-display font-semibold text-ink-950">
            <Sparkles className="h-4 w-4 text-accent" />
            Text embedded per scene
          </h4>
          <p className="mt-1 text-xs text-ink-500">
            Combined into one embedding per scene for semantic search.
          </p>
          <ul className="mt-3 space-y-2">
            {EMBEDDED_FIELDS.map((field) => (
              <li
                key={field}
                className="flex items-start gap-2 text-sm text-ink-700"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {field}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {data.ingestion?.optionalLater?.length > 0 && (
        <details className="rounded-xl border border-ink-200/60 bg-ink-50/50 px-5 py-4">
          <summary className="cursor-pointer text-sm font-medium text-ink-700 flex items-center gap-2">
            <Database className="h-4 w-4 text-ink-400" />
            Planned for v2 (not stored yet)
          </summary>
          <ul className="mt-3 space-y-2 pl-6">
            {data.ingestion.optionalLater.map((item, i) => (
              <li key={i} className="text-sm text-ink-600 list-disc">
                {item}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
