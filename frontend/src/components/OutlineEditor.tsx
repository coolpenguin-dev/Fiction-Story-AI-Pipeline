import { WorkflowStepper } from "./WorkflowStepper";
import type {
  GenerationDraft,
  OutlineDraft,
  WorkflowState,
} from "../types/story";

type Props = {
  outline: OutlineDraft;
  generation: GenerationDraft;
  workflow: WorkflowState;
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
      storyId={storyId}
      storyTitle={storyTitle}
      active={active}
      onOutlineChange={onChange}
      onGenerationChange={onGenerationChange}
      onWorkflowChange={onWorkflowChange}
    />
  );
}
