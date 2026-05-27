import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Layers,
  ListTree,
  Loader2,
  PenLine,
  RefreshCw,
  Sparkles,
  Wand2,
} from "lucide-react";
import { generateFromOutline } from "../api/generate";
import { retrieveSimilarScenes } from "../api/retrieve";
import { StoryStatePanel } from "./StoryStatePanel";
import type {
  GenerationDraft,
  GenerationMode,
  GenerationRetrievalUsed,
  OutlineDraft,
  RetrievedScene,
  StoryState,
  WorkflowApproval,
  WorkflowState,
  WorkflowStepId,
} from "../types/story";

type Props = {
  outline: OutlineDraft;
  generation: GenerationDraft;
  workflow: WorkflowState;
  storyId?: string | null;
  storyTitle?: string;
  storyState: StoryState;
  active: boolean;
  onOutlineChange: (outline: OutlineDraft) => void;
  onGenerationChange: (generation: GenerationDraft) => void;
  onWorkflowChange: (workflow: WorkflowState) => void;
};

type StepDef = {
  id: WorkflowStepId;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  hint: string;
  placeholder: string;
  mode: GenerationMode;
  approvalKey: keyof WorkflowApproval;
  rows: number;
  isDraftStep?: boolean;
};

const STEPS: StepDef[] = [
  {
    id: 1,
    label: "Premise",
    shortLabel: "Premise",
    icon: <BookOpen className="h-4 w-4" />,
    hint: "One-paragraph hook — generate, edit, then approve to continue.",
    placeholder: "Summarize the core conflict and emotional promise…",
    mode: "premise",
    approvalKey: "premise",
    rows: 6,
  },
  {
    id: 2,
    label: "Chapters",
    shortLabel: "Chapters",
    icon: <Layers className="h-4 w-4" />,
    hint: "Chapter-level arc — corpus matches guide pacing from other stories.",
    placeholder: "Chapter 1: …\nChapter 2: …",
    mode: "chapter_outline",
    approvalKey: "chapterOutline",
    rows: 10,
  },
  {
    id: 3,
    label: "Beats",
    shortLabel: "Beats",
    icon: <ListTree className="h-4 w-4" />,
    hint: "Opening-scene granularity — used for retrieval and the prose draft.",
    placeholder: "Scene 1: …\nScene 2: …",
    mode: "scene_beats",
    approvalKey: "sceneBeats",
    rows: 8,
  },
  {
    id: 4,
    label: "Draft",
    shortLabel: "Draft",
    icon: <PenLine className="h-4 w-4" />,
    hint: "Opening prose draft (~600–900 words) — edit freely before export.",
    placeholder: "Generated opening prose will appear here…",
    mode: "opening_draft",
    approvalKey: "openingDraft",
    rows: 16,
    isDraftStep: true,
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

function clearApprovalsFrom(
  stepId: WorkflowStepId,
  approved: WorkflowApproval
): WorkflowApproval {
  if (stepId === 1) {
    return {
      premise: false,
      chapterOutline: false,
      sceneBeats: false,
      openingDraft: false,
    };
  }
  if (stepId === 2) {
    return {
      ...approved,
      chapterOutline: false,
      sceneBeats: false,
      openingDraft: false,
    };
  }
  if (stepId === 3) {
    return { ...approved, sceneBeats: false, openingDraft: false };
  }
  return { ...approved, openingDraft: false };
}

function canAccessStep(stepId: WorkflowStepId, approved: WorkflowApproval): boolean {
  if (stepId === 1) return true;
  if (stepId === 2) return approved.premise;
  if (stepId === 3) return approved.premise && approved.chapterOutline;
  return approved.premise && approved.chapterOutline && approved.sceneBeats;
}

function getStepContent(
  step: StepDef,
  outline: OutlineDraft,
  generation: GenerationDraft
): string {
  if (step.isDraftStep) return generation.openingDraft;
  if (step.approvalKey === "premise") return outline.premise;
  if (step.approvalKey === "chapterOutline") return outline.chapterOutline;
  return outline.sceneBeats;
}

export function WorkflowStepper({
  outline,
  generation,
  workflow,
  storyId,
  storyTitle = "Untitled",
  storyState,
  active,
  onOutlineChange,
  onGenerationChange,
  onWorkflowChange,
}: Props) {
  const [results, setResults] = useState<RetrievedScene[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [lastSources, setLastSources] = useState<GenerationRetrievalUsed[]>([]);

  const currentStepDef = STEPS.find((s) => s.id === workflow.currentStep) ?? STEPS[0];
  const content = getStepContent(currentStepDef, outline, generation);
  const allApproved = Object.values(workflow.approved).every(Boolean);

  const stepProgress = useMemo(
    () => STEPS.filter((s) => workflow.approved[s.approvalKey]).length,
    [workflow.approved]
  );

  const runRetrieval = useCallback(async () => {
    const hasText = [outline.premise, outline.chapterOutline, outline.sceneBeats].some(
      (v) => v?.trim()
    );
    if (!hasText) {
      setResults([]);
      setSearchError("Add text in the current step to search the corpus.");
      return;
    }

    setSearchLoading(true);
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
      setSearchLoading(false);
    }
  }, [outline, storyId]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => {
      void runRetrieval();
    }, 900);
    return () => window.clearTimeout(timer);
  }, [active, outline, runRetrieval]);

  const applyGeneratedContent = (value: string) => {
    onWorkflowChange({
      ...workflow,
      approved: {
        ...workflow.approved,
        [currentStepDef.approvalKey]: false,
      },
    });

    if (currentStepDef.isDraftStep) {
      onGenerationChange({ ...generation, openingDraft: value });
      return;
    }

    if (currentStepDef.approvalKey === "premise") {
      onOutlineChange({ ...outline, premise: value });
    } else if (currentStepDef.approvalKey === "chapterOutline") {
      onOutlineChange({ ...outline, chapterOutline: value });
    } else {
      onOutlineChange({ ...outline, sceneBeats: value });
    }
  };

  const updateContent = (value: string) => {
    onWorkflowChange({
      ...workflow,
      approved: clearApprovalsFrom(currentStepDef.id, workflow.approved),
    });

    if (currentStepDef.isDraftStep) {
      onGenerationChange({ ...generation, openingDraft: value });
      return;
    }

    if (currentStepDef.approvalKey === "premise") {
      onOutlineChange({ ...outline, premise: value });
    } else if (currentStepDef.approvalKey === "chapterOutline") {
      onOutlineChange({ ...outline, chapterOutline: value });
    } else {
      onOutlineChange({ ...outline, sceneBeats: value });
    }
  };

  const goToStep = (stepId: WorkflowStepId) => {
    if (!canAccessStep(stepId, workflow.approved) && stepId > workflow.currentStep) {
      return;
    }
    onWorkflowChange({ ...workflow, currentStep: stepId });
  };

  const handleGenerate = async () => {
    setGenLoading(true);
    setGenError(null);
    try {
      const resp = await generateFromOutline(currentStepDef.mode, {
        outline,
        storyTitle,
        storyId,
        storyState,
        retrievedScenes: results,
      });
      if (!resp.ok) {
        setGenError(resp.error ?? "Generation failed.");
        return;
      }
      applyGeneratedContent(resp.content);
      setLastSources(resp.retrievalUsed);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setGenLoading(false);
    }
  };

  const handleApprove = () => {
    if (!content.trim()) return;

    const nextApproved = {
      ...workflow.approved,
      [currentStepDef.approvalKey]: true,
    } as WorkflowApproval;

    const nextStep = Math.min(4, currentStepDef.id + 1) as WorkflowStepId;

    onWorkflowChange({
      currentStep: currentStepDef.id === 4 ? 4 : nextStep,
      approved: nextApproved,
    });
  };

  const handleBack = () => {
    if (currentStepDef.id <= 1) return;
    onWorkflowChange({
      ...workflow,
      currentStep: (currentStepDef.id - 1) as WorkflowStepId,
    });
  };

  return (
    <div className="rounded-2xl border border-ink-200/80 bg-white shadow-card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-ink-100 bg-gradient-to-r from-ink-50/80 to-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold text-ink-950">
            Writing workflow
          </h3>
          <p className="text-xs text-ink-500 mt-0.5">
            Generate → edit → approve at each step · {stepProgress}/4 complete
          </p>
        </div>
        {allApproved && (
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Workflow complete
          </span>
        )}
      </div>

      {/* Step indicator */}
      <div className="border-b border-ink-100 bg-ink-50/40 px-3 py-3 sm:px-5">
        <ol className="flex gap-1 sm:gap-2 overflow-x-auto pb-1">
          {STEPS.map((step, index) => {
            const isActive = workflow.currentStep === step.id;
            const isApproved = workflow.approved[step.approvalKey];
            const isLocked = !canAccessStep(step.id, workflow.approved) && step.id > workflow.currentStep;
            const hasContent = Boolean(
              step.isDraftStep
                ? generation.openingDraft.trim()
                : getStepContent(step, outline, generation).trim()
            );

            return (
              <li key={step.id} className="flex items-center shrink-0">
                <button
                  type="button"
                  disabled={isLocked}
                  onClick={() => goToStep(step.id)}
                  className={`
                    inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors
                    ${
                      isActive
                        ? "bg-ink-950 text-white shadow-md"
                        : isApproved
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : isLocked
                            ? "bg-ink-50 text-ink-300 cursor-not-allowed"
                            : "bg-white text-ink-600 border border-ink-200 hover:bg-ink-50"
                    }
                  `}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      isActive ? "bg-white/20" : isApproved ? "bg-emerald-200 text-emerald-900" : "bg-ink-100"
                    }`}
                  >
                    {isApproved ? <Check className="h-3 w-3" /> : step.id}
                  </span>
                  <span className="hidden sm:inline">{step.shortLabel}</span>
                  {hasContent && !isApproved && !isActive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                  )}
                </button>
                {index < STEPS.length - 1 && (
                  <span className="mx-1 hidden sm:inline text-ink-300">→</span>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="grid lg:grid-cols-5 lg:min-h-[32rem]">
        <div className="lg:col-span-3 flex flex-col border-b lg:border-b-0 lg:border-r border-ink-100">
          <div className="flex-1 p-5 flex flex-col min-h-[20rem]">
            <div className="flex items-start gap-2 mb-3">
              <span className="text-accent">{currentStepDef.icon}</span>
              <div>
                <h4 className="font-display font-semibold text-sm text-ink-950">
                  Step {currentStepDef.id}: {currentStepDef.label}
                </h4>
                <p className="text-xs text-ink-500 mt-0.5">{currentStepDef.hint}</p>
              </div>
            </div>

            {genError && (
              <p className="text-xs text-red-900 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 mb-3">
                {genError}
              </p>
            )}

            <textarea
              value={content}
              onChange={(e) => updateContent(e.target.value)}
              rows={currentStepDef.rows}
              placeholder={currentStepDef.placeholder}
              className="flex-1 w-full min-h-[16rem] rounded-xl border border-ink-200 bg-ink-50/30 px-4 py-3 text-sm text-ink-800
                leading-relaxed resize-y
                focus:border-accent focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
            />

            <SourcePills sources={lastSources} />

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={genLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-ink-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-50"
              >
                {genLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                {genLoading ? "Generating…" : `Generate ${currentStepDef.shortLabel.toLowerCase()}`}
              </button>

              {currentStepDef.id > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              )}

              <button
                type="button"
                onClick={handleApprove}
                disabled={!content.trim() || workflow.approved[currentStepDef.approvalKey]}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
              >
                {workflow.approved[currentStepDef.approvalKey] ? (
                  <>
                    <Check className="h-4 w-4" />
                    Approved
                  </>
                ) : currentStepDef.id === 4 ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Approve draft
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4" />
                    Approve &amp; continue
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <aside className="lg:col-span-2 flex flex-col bg-ink-50/30 min-h-[18rem] lg:max-h-[calc(100vh-12rem)]">
          <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-4 bg-white/60">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="h-4 w-4 shrink-0 text-accent" />
              <div className="min-w-0">
                <h4 className="font-display font-semibold text-sm text-ink-950">
                  Corpus matches
                </h4>
                <p className="text-[11px] text-ink-500 truncate">
                  From other stories · Pinecone
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void runRetrieval()}
              disabled={searchLoading}
              className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
            >
              {searchLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Refresh
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <StoryStatePanel storyState={storyState} />

            {searchError && (
              <p className="text-xs text-amber-900 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                {searchError}
              </p>
            )}

            {searchLoading && results.length === 0 && !searchError && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-ink-400" />
                <p className="mt-3 text-sm text-ink-500">Searching your corpus…</p>
              </div>
            )}

            {!searchLoading && results.length === 0 && !searchError && (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <Sparkles className="h-8 w-8 text-ink-300" />
                <p className="mt-3 text-sm font-medium text-ink-700">No matches yet</p>
                <p className="mt-1 text-xs text-ink-500">
                  Ingest multiple stories to find cross-manuscript inspiration.
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
  );
}
