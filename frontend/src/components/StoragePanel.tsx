import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  Database,
  Layers,
  Sparkles,
} from "lucide-react";
import type { StoryAnalysis } from "../types/story";

const STORED_METADATA = [
  "story_id",
  "story_title",
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

export function StoragePanel({ data }: Props) {
  const sceneCount = data.scenes?.length ?? 0;
  const pinecone = data.pinecone;
  const hasError = Boolean(pinecone?.error);
  const upserted = pinecone?.upserted ?? 0;
  const saved = !hasError && upserted > 0 && Boolean(data.storyId);

  return (
    <div className="space-y-6">
      <div
        className={`rounded-xl border p-6 shadow-card ${
          hasError
            ? "border-red-200 bg-red-50/80"
            : saved
              ? "border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white"
              : "border-amber-200 bg-gradient-to-br from-amber-50/60 to-white"
        }`}
      >
        <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-ink-950">
          {hasError ? (
            <AlertCircle className="h-5 w-5 text-red-600" />
          ) : saved ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          ) : (
            <Cloud className="h-5 w-5 text-amber-600" />
          )}
          Pinecone storage
        </h3>

        {hasError && (
          <p className="mt-3 text-sm text-red-800 leading-relaxed">
            <span className="font-medium">Could not save vectors.</span>{" "}
            {pinecone?.error}
          </p>
        )}

        {saved && (
          <p className="mt-3 text-sm text-ink-800 leading-relaxed">
            <span className="font-medium text-emerald-800">Saved successfully.</span>{" "}
            {upserted} scene{upserted !== 1 ? "s" : ""} embedded and upserted for
            similarity search when generating new stories.
          </p>
        )}

        {!hasError && !saved && (
          <p className="mt-3 text-sm text-ink-700 leading-relaxed">
            Vectors were not stored. Check that{" "}
            <code className="text-xs bg-ink-100 px-1 py-0.5 rounded">
              PINECONE_API_KEY
            </code>{" "}
            and{" "}
            <code className="text-xs bg-ink-100 px-1 py-0.5 rounded">
              PINECONE_INDEX_NAME
            </code>{" "}
            are set on the server, then run Generate again.
          </p>
        )}

        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-white/70 border border-ink-100 px-4 py-3">
            <dt className="field-label">Story ID</dt>
            <dd className="mt-1 text-sm font-mono text-ink-900 break-all">
              {data.storyId || "—"}
            </dd>
          </div>
          <div className="rounded-lg bg-white/70 border border-ink-100 px-4 py-3">
            <dt className="field-label">Namespace</dt>
            <dd className="mt-1 text-sm text-ink-900">
              {pinecone?.namespace || "fiction (default)"}
            </dd>
          </div>
          <div className="rounded-lg bg-white/70 border border-ink-100 px-4 py-3">
            <dt className="field-label">Vectors upserted</dt>
            <dd className="mt-1 text-sm text-ink-900">
              {hasError ? "—" : `${upserted} / ${sceneCount} scenes`}
            </dd>
          </div>
          <div className="rounded-lg bg-white/70 border border-ink-100 px-4 py-3">
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
