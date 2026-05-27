import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  Check,
  Layers,
  ListTree,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
} from "lucide-react";
import { retrieveSimilarScenes } from "../api/retrieve";
import { GenerationPanel } from "./GenerationPanel";
import type { GenerationDraft, OutlineDraft, RetrievedScene } from "../types/story";

type Props = {
  outline: OutlineDraft;
  storyId?: string | null;
  storyTitle?: string;
  active: boolean;
  onChange: (outline: OutlineDraft) => void;
  generation: GenerationDraft;
  onGenerationChange: (generation: GenerationDraft) => void;
};

type OutlineStep = "premise" | "chapterOutline" | "sceneBeats";

const STEPS: {
  id: OutlineStep;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  hint: string;
  rows: number;
  placeholder: string;
}[] = [
  {
    id: "premise",
    label: "Premise",
    shortLabel: "Premise",
    icon: <BookOpen className="h-4 w-4" />,
    hint: "One-paragraph hook for the story.",
    rows: 6,
    placeholder: "Summarize the core conflict and emotional promise…",
  },
  {
    id: "chapterOutline",
    label: "Chapter outline",
    shortLabel: "Chapters",
    icon: <Layers className="h-4 w-4" />,
    hint: "Chapter-level beats — drives corpus similarity search.",
    rows: 10,
    placeholder: "Chapter 1: …\nChapter 2: …",
  },
  {
    id: "sceneBeats",
    label: "Scene beats",
    shortLabel: "Beats",
    icon: <ListTree className="h-4 w-4" />,
    hint: "Opening-scene granularity for retrieval.",
    rows: 8,
    placeholder: "Scene 1: …\nScene 2: …",
  },
];

function parseSnippet(snippet: string): { label: string; value: string }[] {
  return snippet
    .split("\n")
    .map((line) => {
      const idx = line.indexOf(": ");
      if (idx === -1) return { label: "Detail", value: line.trim() };
      return { label: line.slice(0, idx).trim(), value: line.slice(idx + 2).trim() };
    })
    .filter((row) => row.value);
}

function SimilarityBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  return (
    <div className="flex items-center gap-2 min-w-[4.5rem]">
      <div className="flex-1 h-1.5 rounded-full bg-ink-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-semibold tabular-nums text-ink-600 w-7 text-right">
        {pct}%
      </span>
    </div>
  );
}

function CorpusMatchCard({ scene }: { scene: RetrievedScene }) {
  const fields = parseSnippet(scene.snippet);

  return (
    <article className="rounded-xl border border-ink-200/80 bg-white p-4 shadow-sm hover:border-ink-300/80 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-sm text-ink-900 leading-snug truncate">
            {scene.storyTitle}
          </p>
          <p className="mt-0.5 text-xs text-ink-500 font-mono truncate">
            {scene.sceneId}
            {scene.chapter != null ? ` · Ch ${scene.chapter}` : ""}
          </p>
        </div>
        <SimilarityBar score={scene.score} />
      </div>

      {scene.sourceFileName && (
        <p className="mt-2 text-[11px] text-ink-400 truncate" title={scene.sourceFileName}>
          {scene.sourceFileName}
        </p>
      )}

      <dl className="mt-3 space-y-2">
        {fields.slice(0, 4).map(({ label, value }) => (
          <div key={label}>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
              {label}
            </dt>
            <dd className="mt-0.5 text-xs text-ink-700 leading-relaxed line-clamp-3">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

export function OutlineEditor({
  outline,
  storyId,
  storyTitle = "Untitled",
  active,
  onChange,
  generation,
  onGenerationChange,
}: Props) {
  const [saved, setSaved] = useState(false);
  const [step, setStep] = useState<OutlineStep>("premise");
  const [results, setResults] = useState<RetrievedScene[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const currentStep = STEPS.find((s) => s.id === step)!;

  const update = (key: OutlineStep, value: string) => {
    setSaved(false);
    onChange({ ...outline, [key]: value });
  };

  const handleSave = () => {
    localStorage.setItem("fiction-rag-outline", JSON.stringify(outline));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const runRetrieval = useCallback(async () => {
    const hasText = [outline.premise, outline.chapterOutline, outline.sceneBeats].some(
      (v) => v?.trim()
    );
    if (!hasText) {
      setResults([]);
      setSearchError("Add premise or outline text to search the corpus.");
      return;
    }

    setLoading(true);
    setSearchError(null);
    try {
      const resp = await retrieveSimilarScenes(outline, {
        topK: 5,
        excludeStoryId: storyId ?? null,
      });
      setResults(resp.results);
      if (resp.error && resp.results.length === 0) {
        setSearchError(resp.error);
      }
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Retrieval failed.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [outline, storyId]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => {
      void runRetrieval();
    }, 900);
    return () => window.clearTimeout(timer);
  }, [active, outline, runRetrieval]);

  return (
    <div className="space-y-6">
    <div className="rounded-2xl border border-ink-200/80 bg-white shadow-card overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-ink-100 bg-gradient-to-r from-ink-50/80 to-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold text-ink-950">Outline draft</h3>
          <p className="text-xs text-ink-500 mt-0.5">
            Edit step-by-step · corpus matches update from other stories
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {loading && (
            <span className="inline-flex items-center gap-1.5 text-xs text-ink-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Searching…
            </span>
          )}
          {!loading && results.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
              <Check className="h-3.5 w-3.5" />
              {results.length} match{results.length === 1 ? "" : "es"}
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50"
          >
            <Save className="h-3.5 w-3.5" />
            {saved ? "Saved" : "Save locally"}
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 lg:min-h-[32rem]">
        {/* Editor column */}
        <div className="lg:col-span-3 flex flex-col border-b lg:border-b-0 lg:border-r border-ink-100">
          <div
            className="flex gap-0 overflow-x-auto border-b border-ink-100 bg-ink-50/40 px-2 pt-2"
            role="tablist"
            aria-label="Outline sections"
          >
            {STEPS.map((s) => {
              const isActive = step === s.id;
              const hasContent = Boolean(outline[s.id]?.trim());
              return (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setStep(s.id)}
                  className={`
                    relative shrink-0 inline-flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors
                    ${
                      isActive
                        ? "bg-white text-ink-950 shadow-sm border border-b-0 border-ink-200/80 -mb-px z-10"
                        : "text-ink-500 hover:text-ink-800 hover:bg-white/60"
                    }
                  `}
                >
                  <span className={isActive ? "text-accent" : "text-ink-400"}>{s.icon}</span>
                  {s.shortLabel}
                  {hasContent && !isActive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex-1 p-5 flex flex-col min-h-[20rem]">
            <label htmlFor={`outline-${step}`} className="sr-only">
              {currentStep.label}
            </label>
            <p className="text-xs text-ink-500 mb-3">{currentStep.hint}</p>
            <textarea
              id={`outline-${step}`}
              value={outline[step]}
              onChange={(e) => update(step, e.target.value)}
              rows={currentStep.rows}
              placeholder={currentStep.placeholder}
              className="flex-1 w-full min-h-[16rem] rounded-xl border border-ink-200 bg-ink-50/30 px-4 py-3 text-sm text-ink-800
                leading-relaxed resize-none
                focus:border-accent focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
            />
          </div>
        </div>

        {/* Corpus sidebar */}
        <aside className="lg:col-span-2 flex flex-col bg-ink-50/30 min-h-[18rem] lg:max-h-[calc(100vh-12rem)]">
          <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-4 bg-white/60">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="h-4 w-4 shrink-0 text-accent" />
              <div className="min-w-0">
                <h4 className="font-display font-semibold text-sm text-ink-950">
                  Corpus matches
                </h4>
                <p className="text-[11px] text-ink-500 truncate">Similar scenes · Pinecone</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void runRetrieval()}
              disabled={loading}
              className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Refresh
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {searchError && (
              <p className="text-xs text-amber-900 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                {searchError}
              </p>
            )}

            {loading && results.length === 0 && !searchError && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-ink-400" />
                <p className="mt-3 text-sm text-ink-500">Searching your corpus…</p>
              </div>
            )}

            {!loading && results.length === 0 && !searchError && (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <Sparkles className="h-8 w-8 text-ink-300" />
                <p className="mt-3 text-sm font-medium text-ink-700">No matches yet</p>
                <p className="mt-1 text-xs text-ink-500">
                  Ingest multiple stories, then edit the outline to find similar beats.
                </p>
              </div>
            )}

            {results.map((scene) => (
              <CorpusMatchCard
                key={`${scene.storyId}-${scene.sceneId}-${scene.score}`}
                scene={scene}
              />
            ))}
          </div>
        </aside>
      </div>
    </div>

      <GenerationPanel
        outline={outline}
        storyTitle={storyTitle}
        storyId={storyId}
        retrievedScenes={results}
        generation={generation}
        onGenerationChange={onGenerationChange}
      />
    </div>
  );
}
