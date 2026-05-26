export type AnalysisMode = "linear_choice_1" | "full_branching";

export type SceneSummary = {
  id: string;
  chapter?: number;
  pathLabel?: string;
  isChoicePoint?: boolean;
  choiceSummary?: string | null;
  title: string;
  setting: string;
  pov: string;
  characters: string[];
  plotBeat: string;
  conflict: string;
  relationshipBeats: string;
  tone: string;
  openThreads: string[];
};

export type NarrativePattern = {
  id: string;
  name: string;
  description: string;
  evidenceSceneIds: string[];
};

export type OutlineDraft = {
  premise: string;
  chapterOutline: string;
  sceneBeats: string;
  canonicalPathNote?: string;
};

export type RetrievedExample = {
  label: string;
  snippet: string;
};

export type RelationshipRow = {
  chapterOrScene: string;
  pair: string;
  trust: "low" | "medium" | "high" | string;
  tension: "low" | "medium" | "high" | string;
  intimacy: "low" | "medium" | "high" | string;
  notes: string;
};

export type IngestionRecommendation = {
  chunkLevel: string;
  metadataFields: string[];
  embedWhat: string[];
  optionalLater: string[];
};

export type StoryAnalysis = {
  storyId?: string;
  storyTitle: string;
  analysisMode?: AnalysisMode;
  canonicalPathNote?: string;
  scenes: SceneSummary[];
  patterns: NarrativePattern[];
  outline: OutlineDraft;
  retrievedExamples: RetrievedExample[];
  relationships: RelationshipRow[];
  ingestion: IngestionRecommendation;
  pinecone?: { upserted?: number; namespace?: string; error?: string };
};

export type TabId =
  | "scenes"
  | "patterns"
  | "outline"
  | "relationships"
  | "ingestion";
