import { WorkflowStepper } from "./WorkflowStepper";
import type {
  GenerationDraft,
  OutlineDraft,
  RetrievalPreferences,
  StoryState,
  WorkflowState,
} from "../types/story";

type Props = {
  outline: OutlineDraft;
  generation: GenerationDraft;
  workflow: WorkflowState;
  storyState: StoryState;
  retrievalPrefs: RetrievalPreferences;
  storyId?: string | null;
  storyTitle?: string;
  active: boolean;
  onChange: (outline: OutlineDraft) => void;
  onGenerationChange: (generation: GenerationDraft) => void;
  onWorkflowChange: (workflow: WorkflowState) => void;
  onRetrievalPrefsChange: (prefs: RetrievalPreferences) => void;
};

/** Outline tab — gated RAG writing workflow (Phase B). */
export function OutlineEditor({
  outline,
  generation,
  workflow,
  storyState,
  retrievalPrefs,
  storyId,
  storyTitle,
  active,
  onChange,
  onGenerationChange,
  onWorkflowChange,
  onRetrievalPrefsChange,
}: Props) {
  return (
    <WorkflowStepper
      outline={outline}
      generation={generation}
      workflow={workflow}
      storyState={storyState}
      retrievalPrefs={retrievalPrefs}
      storyId={storyId}
      storyTitle={storyTitle}
      active={active}
      onOutlineChange={onChange}
      onGenerationChange={onGenerationChange}
      onWorkflowChange={onWorkflowChange}
      onRetrievalPrefsChange={onRetrievalPrefsChange}
    />
  );
}
