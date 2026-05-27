import { WorkflowStepper } from "./WorkflowStepper";
import type {
  GenerationDraft,
  OutlineDraft,
  StoryState,
  WorkflowState,
} from "../types/story";

type Props = {
  outline: OutlineDraft;
  generation: GenerationDraft;
  workflow: WorkflowState;
  storyState: StoryState;
  storyId?: string | null;
  storyTitle?: string;
  active: boolean;
  onChange: (outline: OutlineDraft) => void;
  onGenerationChange: (generation: GenerationDraft) => void;
  onWorkflowChange: (workflow: WorkflowState) => void;
};

/** Outline tab — gated RAG writing workflow (Phase B). */
export function OutlineEditor({
  outline,
  generation,
  workflow,
  storyState,
  storyId,
  storyTitle,
  active,
  onChange,
  onGenerationChange,
  onWorkflowChange,
}: Props) {
  return (
    <WorkflowStepper
      outline={outline}
      generation={generation}
      workflow={workflow}
      storyState={storyState}
      storyId={storyId}
      storyTitle={storyTitle}
      active={active}
      onOutlineChange={onChange}
      onGenerationChange={onGenerationChange}
      onWorkflowChange={onWorkflowChange}
    />
  );
}
