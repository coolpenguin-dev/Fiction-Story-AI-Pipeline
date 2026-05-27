import {
  BookMarked,
  Database,
  GitBranch,
  Heart,
  Layers,
} from "lucide-react";
import type { TabId, StoryAnalysis, GenerationDraft, WorkflowState } from "../types/story";
import { SceneSummaryList } from "./SceneSummaryList";
import { NarrativePatternsPanel } from "./NarrativePatternsPanel";
import { OutlineEditor } from "./OutlineEditor";
import { RelationshipTable } from "./RelationshipTable";
import { StoragePanel } from "./StoragePanel";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "scenes", label: "Scenes", icon: <BookMarked className="h-4 w-4" /> },
  { id: "patterns", label: "Patterns", icon: <GitBranch className="h-4 w-4" /> },
  { id: "outline", label: "Outline", icon: <Layers className="h-4 w-4" /> },
  {
    id: "relationships",
    label: "Relationships",
    icon: <Heart className="h-4 w-4" />,
  },
  { id: "ingestion", label: "Storage", icon: <Database className="h-4 w-4" /> },
];

type Props = {
  data: StoryAnalysis;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  outline: StoryAnalysis["outline"];
  onOutlineChange: (outline: StoryAnalysis["outline"]) => void;
  generation: GenerationDraft;
  onGenerationChange: (generation: GenerationDraft) => void;
  workflow: WorkflowState;
  onWorkflowChange: (workflow: WorkflowState) => void;
};

export function ResultsPanel({
  data,
  activeTab,
  onTabChange,
  outline,
  onOutlineChange,
  generation,
  onGenerationChange,
  workflow,
  onWorkflowChange,
}: Props) {
  const goToScenes = (sceneId: string) => {
    onTabChange("scenes");
    requestAnimationFrame(() => {
      document.getElementById(sceneId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  return (
    <section className="animate-fade-in">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">
            Analysis complete
          </p>
          <h2 className="font-display text-2xl font-bold text-ink-950">
            {data.storyTitle}
          </h2>
          {(data.canonicalPathNote || data.analysisMode) && (
            <p className="mt-2 text-sm text-ink-600 max-w-2xl">
              {data.analysisMode === "linear_choice_1" && (
                <span className="font-medium text-ink-700">Canonical path: Choice 1 · </span>
              )}
              {data.analysisMode === "full_branching" && (
                <span className="font-medium text-ink-700">Full branching · </span>
              )}
              {data.canonicalPathNote}
            </p>
          )}
        </div>
      </div>

      <nav
        className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin"
        aria-label="Results sections"
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`
                inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all
                ${
                  active
                    ? "bg-ink-950 text-white shadow-md"
                    : "bg-white text-ink-600 border border-ink-200 hover:bg-ink-50 hover:text-ink-900"
                }
              `}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-6">
        {activeTab === "scenes" && <SceneSummaryList scenes={data.scenes} />}
        {activeTab === "patterns" && (
          <NarrativePatternsPanel
            patterns={data.patterns}
            onSceneClick={goToScenes}
          />
        )}
        {activeTab === "outline" && (
          <OutlineEditor
            outline={outline}
            storyId={data.storyId}
            storyTitle={data.storyTitle}
            active={activeTab === "outline"}
            onChange={onOutlineChange}
            generation={generation}
            onGenerationChange={onGenerationChange}
            workflow={workflow}
            onWorkflowChange={onWorkflowChange}
          />
        )}
        {activeTab === "relationships" && (
          <RelationshipTable rows={data.relationships} />
        )}
        {activeTab === "ingestion" && <StoragePanel data={data} />}
      </div>
    </section>
  );
}
