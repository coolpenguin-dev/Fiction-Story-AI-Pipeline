export type SceneSummary = {
  id: string;
  chapter?: number;
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

export type TrialData = {
  storyTitle: string;
  scenes: SceneSummary[];
  patterns: NarrativePattern[];
  outline: OutlineDraft;
  retrievedExamples: RetrievedExample[];
  relationships: RelationshipRow[];
  ingestion: IngestionRecommendation;
};

export type TabId =
  | "scenes"
  | "patterns"
  | "outline"
  | "relationships"
  | "ingestion";
