import { useState } from "react";
import {
  BookText,
  Loader2,
  PenLine,
  Sparkles,
  Wand2,
} from "lucide-react";
import { generateFromOutline } from "../api/generate";
import type {
  GenerationDraft,
  GenerationMode,
  GenerationRetrievalUsed,
  OutlineDraft,
  RetrievedScene,
} from "../types/story";

type Props = {
  outline: OutlineDraft;
  storyTitle: string;
  storyId?: string | null;
  retrievedScenes: RetrievedScene[];
  generation: GenerationDraft;
  onGenerationChange: (generation: GenerationDraft) => void;
};

const MODES: {
  id: GenerationMode;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  hint: string;
  field: keyof GenerationDraft;
}[] = [
  {
    id: "chapter_beats",
    label: "Chapter beats",
    shortLabel: "Beats",
    icon: <BookText className="h-4 w-4" />,
    hint: "Expand your outline into numbered chapters with bullet beats.",
    field: "chapterBeats",
  },
  {
    id: "opening_draft",
    label: "Opening draft",
    shortLabel: "Draft",
    icon: <PenLine className="h-4 w-4" />,
    hint: "Prose draft for the opening scene, grounded in your beats.",
    field: "openingDraft",
  },
];

function SourcePills({ sources }: { sources: GenerationRetrievalUsed[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-3">
      {sources.map((src) => (
        <span
          key={`${src.storyId}-${src.sceneId}`}
          className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-ink-50 px-2 py-0.5 text-[10px] text-ink-600"
          title={src.sourceFileName ?? undefined}
        >
          {src.storyTitle}
          {src.sceneId ? ` · ${src.sceneId}` : ""}
          {src.score != null ? ` (${Math.round(src.score * 100)}%)` : ""}
        </span>
      ))}
    </div>
  );
}

export function GenerationPanel({
  outline,
  storyTitle,
  storyId,
  retrievedScenes,
  generation,
  onGenerationChange,
}: Props) {
  const [mode, setMode] = useState<GenerationMode>("chapter_beats");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSources, setLastSources] = useState<GenerationRetrievalUsed[]>([]);

  const current = MODES.find((m) => m.id === mode)!;
  const content = generation[current.field];

  const updateContent = (value: string) => {
    onGenerationChange({ ...generation, [current.field]: value });
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await generateFromOutline(mode, {
        outline,
        storyTitle,
        storyId,
        retrievedScenes,
      });
      if (!resp.ok) {
        setError(resp.error ?? "Generation failed.");
        return;
      }
      onGenerationChange({ ...generation, [current.field]: resp.content });
      setLastSources(resp.retrievalUsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-ink-200/80 bg-white shadow-card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-ink-100 bg-gradient-to-r from-accent/5 to-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Wand2 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-ink-950">
              RAG-assisted generation
            </h3>
            <p className="text-xs text-ink-500 mt-0.5">
              Draft from your outline + corpus matches · edit before the next step
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {loading ? "Generating…" : `Generate ${current.shortLabel.toLowerCase()}`}
        </button>
      </div>

      <div className="flex gap-0 overflow-x-auto border-b border-ink-100 bg-ink-50/40 px-2 pt-2">
        {MODES.map((m) => {
          const isActive = mode === m.id;
          const hasContent = Boolean(generation[m.field]?.trim());
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`
                relative shrink-0 inline-flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors
                ${
                  isActive
                    ? "bg-white text-ink-950 shadow-sm border border-b-0 border-ink-200/80 -mb-px z-10"
                    : "text-ink-500 hover:text-ink-800 hover:bg-white/60"
                }
              `}
            >
              <span className={isActive ? "text-accent" : "text-ink-400"}>{m.icon}</span>
              {m.label}
              {hasContent && !isActive && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
              )}
            </button>
          );
        })}
      </div>

      <div className="p-5">
        <p className="text-xs text-ink-500 mb-3">{current.hint}</p>

        {retrievedScenes.length > 0 && (
          <p className="text-[11px] text-ink-400 mb-3">
            Using {retrievedScenes.length} corpus match
            {retrievedScenes.length === 1 ? "" : "es"} as craft references
            {retrievedScenes[0]?.storyTitle ? ` (from ${retrievedScenes[0].storyTitle})` : ""}.
          </p>
        )}

        {error && (
          <p className="text-xs text-red-900 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 mb-3">
            {error}
          </p>
        )}

        <textarea
          value={content}
          onChange={(e) => updateContent(e.target.value)}
          rows={14}
          placeholder={
            mode === "chapter_beats"
              ? "Generated chapter beats will appear here…"
              : "Generated opening prose will appear here…"
          }
          className="w-full min-h-[18rem] rounded-xl border border-ink-200 bg-ink-50/30 px-4 py-3 text-sm text-ink-800
            leading-relaxed resize-y
            focus:border-accent focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
        />

        <SourcePills sources={lastSources} />
      </div>
    </div>
  );
}
