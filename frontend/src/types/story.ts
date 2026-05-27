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

export type RetrievedScene = {
  storyId: string;
  storyTitle: string;
  sourceFileName?: string | null;
  sceneId: string;
  chapter?: number | null;
  score: number;
  label: string;
  snippet: string;
};

export type RetrieveResponse = {
  configured: boolean;
  namespace?: string;
  results: RetrievedScene[];
  queryPreview?: string;
  excludeStoryId?: string | null;
  error?: string;
};

export type GenerationMode = "chapter_beats" | "opening_draft";

export type GenerationDraft = {
  chapterBeats: string;
  openingDraft: string;
};

export const EMPTY_GENERATION: GenerationDraft = {
  chapterBeats: "",
  openingDraft: "",
};

export type GenerationRetrievalUsed = {
  storyId?: string;
  storyTitle?: string;
  sceneId?: string;
  score?: number;
  sourceFileName?: string | null;
};

export type GenerateResponse = {
  ok: boolean;
  mode: GenerationMode;
  content: string;
  error?: string;
  retrievalUsed: GenerationRetrievalUsed[];
};

export type RelationshipRow = {
  chapterOrScene: string;
  pair: string;
  trust: "low" | "medium" | "high" | string;
  tension: "low" | "medium" | "high" | string;
  intimacy: "low" | "medium" | "high" | string;
  notes: string;
};

export type PineconeStatus = "ok" | "partial" | "skipped" | "error";

export type PineconeInfo = {
  configured?: boolean | null;
  status?: PineconeStatus;
  upserted?: number;
  expected?: number;
  namespace?: string;
  replaced?: boolean;
  error?: string;
};

export type IngestionRecommendation = {
  chunkLevel: string;
  metadataFields: string[];
  embedWhat: string[];
  optionalLater: string[];
};

export type StoryAnalysis = {
  storyId?: string;
  sourceFileName?: string;
  storyTitle: string;
  analysisMode?: AnalysisMode;
  canonicalPathNote?: string;
  scenes: SceneSummary[];
  patterns: NarrativePattern[];
  outline: OutlineDraft;
  retrievedExamples: RetrievedExample[];
  relationships: RelationshipRow[];
  ingestion: IngestionRecommendation;
  pinecone?: PineconeInfo;
};

export type TabId =
  | "scenes"
  | "patterns"
  | "outline"
  | "relationships"
  | "ingestion";

export type CorpusEntry = {
  fileName: string;
  fileSize?: number;
  data: StoryAnalysis;
  outline: OutlineDraft;
  generation?: GenerationDraft;
};

export type BatchStoryResult = {
  fileName: string;
  ok: boolean;
  data?: StoryAnalysis;
  error?: string;
};

export type BatchAnalyzeResponse = {
  results: BatchStoryResult[];
  summary: { total: number; succeeded: number; failed: number };
};

export const MAX_CORPUS_FILES = 5;

export type AnalyzeProgress = {
  completed: number;
  total: number;
  currentFileName: string;
  percent: number;
};
