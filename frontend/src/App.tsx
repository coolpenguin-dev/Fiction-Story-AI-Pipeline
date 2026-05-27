import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import { analyzePdf } from "./api/analyze";
import { fetchHealth } from "./api/health";
import { fetchCorpus } from "./api/corpus";
import { UploadPanel } from "./components/UploadPanel";
import { ResultsPanel } from "./components/ResultsPanel";
import { CorpusStoryPicker } from "./components/CorpusStoryPicker";
import { CorpusLibraryPanel } from "./components/CorpusLibraryPanel";
import { clearSession, loadSession, saveSession } from "./lib/session";
import type {
  BatchStoryResult,
  AnalyzeProgress,
  CorpusEntry,
  CorpusListResponse,
  HealthResponse,
  TabId,
} from "./types/story";

function getInitialState() {
  const session = loadSession();
  if (!session) {
    return {
      corpus: [] as CorpusEntry[],
      selectedIndex: 0,
      activeTab: "scenes" as TabId,
    };
  }
  return {
    corpus: session.corpus,
    selectedIndex: session.selectedIndex,
    activeTab: session.activeTab,
  };
}

export default function App() {
  const initial = getInitialState();
  const [files, setFiles] = useState<File[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<AnalyzeProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [corpus, setCorpus] = useState<CorpusEntry[]>(initial.corpus);
  const [selectedIndex, setSelectedIndex] = useState(initial.selectedIndex);
  const [activeTab, setActiveTab] = useState<TabId>(initial.activeTab);
  const [batchFailures, setBatchFailures] = useState<BatchStoryResult[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [storedCorpus, setStoredCorpus] = useState<CorpusListResponse | null>(null);
  const [corpusLoading, setCorpusLoading] = useState(true);
  const [corpusError, setCorpusError] = useState<string | null>(null);

  const refreshHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      setHealth(await fetchHealth());
    } catch (e) {
      setHealthError(e instanceof Error ? e.message : "Health check failed.");
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const refreshCorpus = useCallback(async () => {
    setCorpusLoading(true);
    setCorpusError(null);
    try {
      setStoredCorpus(await fetchCorpus());
    } catch (e) {
      setCorpusError(e instanceof Error ? e.message : "Failed to load corpus.");
      setStoredCorpus(null);
    } finally {
      setCorpusLoading(false);
      void refreshHealth();
    }
  }, [refreshHealth]);

  useEffect(() => {
    void refreshCorpus();
  }, [refreshCorpus]);

  const selected = corpus[selectedIndex] ?? null;
  const hasResults = corpus.length > 0 && Boolean(selected);

  const outlinesByIndex = useMemo(
    () => corpus.map((e) => e.outline),
    [corpus]
  );

  useEffect(() => {
    if (corpus.length === 0) return;
    saveSession({ corpus, selectedIndex, activeTab });
  }, [corpus, selectedIndex, activeTab]);

  const handleGenerate = useCallback(async () => {
    if (files.length === 0) return;
    setError(null);
    setBatchFailures([]);
    setIsLoading(true);

    const total = files.length;
    const succeeded: CorpusEntry[] = [];
    const failures: BatchStoryResult[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress({
          completed: i,
          total,
          currentFileName: file.name,
          percent: Math.round(((i + 0.5) / total) * 100),
        });

        try {
          const result = await analyzePdf(file, apiKey);
          succeeded.push({
            fileName: file.name,
            fileSize: file.size,
            data: result,
            outline: result.outline,
          });
          setProgress({
            completed: i + 1,
            total,
            currentFileName: file.name,
            percent: Math.round(((i + 1) / total) * 100),
          });
        } catch (e) {
          failures.push({
            fileName: file.name,
            ok: false,
            error: e instanceof Error ? e.message : "Analysis failed.",
          });
          setProgress({
            completed: i + 1,
            total,
            currentFileName: file.name,
            percent: Math.round(((i + 1) / total) * 100),
          });
        }
      }

      if (succeeded.length === 0) {
        const firstErr = failures[0]?.error ?? "All files failed to analyze.";
        throw new Error(firstErr);
      }

      setCorpus(succeeded);
      setSelectedIndex(0);
      setBatchFailures(failures);
      setActiveTab("scenes");

      if (failures.length > 0) {
        setError(
          `${failures.length} of ${total} file(s) failed. See details below.`
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setIsLoading(false);
      setProgress(null);
      void refreshCorpus();
    }
  }, [files, apiKey, refreshCorpus]);

  const handleClear = useCallback(() => {
    clearSession();
    setFiles([]);
    setCorpus([]);
    setSelectedIndex(0);
    setBatchFailures([]);
    setActiveTab("scenes");
    setError(null);
  }, []);

  const handleOutlineChange = useCallback(
    (outline: CorpusEntry["outline"]) => {
      setCorpus((prev) =>
        prev.map((entry, i) =>
          i === selectedIndex ? { ...entry, outline } : entry
        )
      );
    },
    [selectedIndex]
  );

  const handleSelectStory = useCallback((index: number) => {
    setSelectedIndex(index);
    setActiveTab("scenes");
  }, []);

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink-200/60 bg-white/80 backdrop-blur-md sticky top-0 z-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-950 text-white">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold text-ink-950 leading-tight">
              Fiction RAG
            </h1>
            <p className="text-xs text-ink-500">
              Interactive fiction corpus · analysis &amp; vector storage
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-10">
        <UploadPanel
          files={files}
          onFilesChange={setFiles}
          apiKey={apiKey}
          onApiKeyChange={setApiKey}
          onGenerate={handleGenerate}
          onClear={handleClear}
          isLoading={isLoading}
          progress={progress}
          error={error}
          canClear={hasResults || files.length > 0}
          health={health}
          healthLoading={healthLoading}
          healthError={healthError}
          corpusVectorCount={storedCorpus?.summary.totalVectors}
        />

        <CorpusLibraryPanel
          corpus={storedCorpus}
          sessionCorpus={corpus}
          loading={corpusLoading}
          error={corpusError}
          onRefresh={() => void refreshCorpus()}
        />

        {hasResults && !isLoading && selected && (
          <div className="space-y-6">
            <CorpusStoryPicker
              corpus={corpus}
              selectedIndex={selectedIndex}
              onSelect={handleSelectStory}
              batchFailures={batchFailures}
            />
            <ResultsPanel
              key={selected.data.storyId ?? selected.fileName}
              data={selected.data}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              outline={outlinesByIndex[selectedIndex] ?? selected.outline}
              onOutlineChange={handleOutlineChange}
            />
          </div>
        )}
      </main>
    </div>
  );
}
