import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import { analyzePdf, analyzePdfBatch } from "./api/analyze";
import { fetchHealth } from "./api/health";
import { UploadPanel } from "./components/UploadPanel";
import { ResultsPanel } from "./components/ResultsPanel";
import { CorpusStoryPicker } from "./components/CorpusStoryPicker";
import { clearSession, loadSession, saveSession } from "./lib/session";
import type { BatchStoryResult, CorpusEntry, HealthResponse, TabId } from "./types/story";

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
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [corpus, setCorpus] = useState<CorpusEntry[]>(initial.corpus);
  const [selectedIndex, setSelectedIndex] = useState(initial.selectedIndex);
  const [activeTab, setActiveTab] = useState<TabId>(initial.activeTab);
  const [batchFailures, setBatchFailures] = useState<BatchStoryResult[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);

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

  useEffect(() => {
    void refreshHealth();
  }, [refreshHealth]);

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

    try {
      if (files.length === 1) {
        setLoadingLabel("Analyzing manuscript…");
        const result = await analyzePdf(files[0], apiKey);
        const entry: CorpusEntry = {
          fileName: files[0].name,
          fileSize: files[0].size,
          data: result,
          outline: result.outline,
        };
        setCorpus([entry]);
        setSelectedIndex(0);
        setActiveTab("scenes");
        return;
      }

      setLoadingLabel(`Analyzing ${files.length} manuscripts…`);
      const batch = await analyzePdfBatch(files, apiKey);

      const succeeded: CorpusEntry[] = [];
      const failures: BatchStoryResult[] = [];

      for (const item of batch.results) {
        if (item.ok && item.data) {
          const match = files.find((f) => f.name === item.fileName);
          succeeded.push({
            fileName: item.fileName,
            fileSize: match?.size,
            data: item.data,
            outline: item.data.outline,
          });
        } else {
          failures.push(item);
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
          `${failures.length} of ${batch.summary.total} file(s) failed. See details below.`
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setIsLoading(false);
      setLoadingLabel(null);
      void refreshHealth();
    }
  }, [files, apiKey, refreshHealth]);

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
          loadingLabel={loadingLabel}
          error={error}
          canClear={hasResults || files.length > 0}
          health={health}
          healthLoading={healthLoading}
          healthError={healthError}
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

        {!hasResults && !isLoading && (
          <section className="grid gap-4 sm:grid-cols-3 text-center">
            {[
              {
                title: "Multi-story corpus",
                desc: "Upload 1–5 PDFs for your POC library",
              },
              {
                title: "Narrative patterns",
                desc: "Discovered per story, stored for retrieval",
              },
              {
                title: "Editable outline",
                desc: "Premise → chapters → beats per manuscript",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-ink-200/60 bg-white/60 px-4 py-6"
              >
                <p className="font-display font-semibold text-ink-900">{item.title}</p>
                <p className="mt-1 text-xs text-ink-500">{item.desc}</p>
              </div>
            ))}
          </section>
        )}
      </main>

      <footer className="border-t border-ink-200/60 mt-16 py-6 text-center text-xs text-ink-400">
        Fiction RAG · Manuscript analysis with Pinecone-backed retrieval
      </footer>
    </div>
  );
}
