import { useCallback, useState } from "react";
import { BookOpen } from "lucide-react";
import { analyzePdf } from "./api/analyze";
import { UploadPanel } from "./components/UploadPanel";
import { ResultsPanel } from "./components/ResultsPanel";
import type { TabId, TrialData } from "./types/trial";

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TrialData | null>(null);
  const [outline, setOutline] = useState<TrialData["outline"] | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("scenes");

  const handleGenerate = useCallback(async () => {
    if (!file) return;
    setError(null);
    setIsLoading(true);
    try {
      const result = await analyzePdf(file, apiKey);
      setData(result);
      setOutline(result.outline);
      setActiveTab("scenes");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setIsLoading(false);
    }
  }, [file, apiKey]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink-200/60 bg-white/80 backdrop-blur-md sticky top-0 z-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-950 text-white">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold text-ink-950 leading-tight">
              Fiction RAG Trial
            </h1>
            <p className="text-xs text-ink-500">
              Story analysis for collaborative fiction writing
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-10">
        <UploadPanel
          file={file}
          onFileChange={setFile}
          apiKey={apiKey}
          onApiKeyChange={setApiKey}
          onGenerate={handleGenerate}
          isLoading={isLoading}
          error={error}
        />

        {isLoading && (
          <div
            className="rounded-2xl border border-ink-200 bg-white p-12 text-center shadow-card"
            aria-live="polite"
          >
            <div className="mx-auto h-10 w-10 rounded-full border-2 border-ink-200 border-t-accent animate-spin" />
            <p className="mt-4 font-display text-lg font-semibold text-ink-900">
              Reading your manuscript…
            </p>
            <p className="mt-2 text-sm text-ink-500 animate-pulse-soft">
              Extracting scenes, patterns, outlines, and ingestion recommendations.
              This may take a minute.
            </p>
          </div>
        )}

        {data && outline && !isLoading && (
          <ResultsPanel
            data={data}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            outline={outline}
            onOutlineChange={setOutline}
          />
        )}

        {!data && !isLoading && (
          <section className="grid gap-4 sm:grid-cols-3 text-center">
            {[
              {
                title: "Scene summaries",
                desc: "Structured beats per scene for RAG chunks",
              },
              {
                title: "Narrative patterns",
                desc: "Discovered from your text, not preset tropes",
              },
              {
                title: "Editable outline",
                desc: "Premise → chapters → beats at every step",
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
        Fiction RAG Trial · Built for manuscript analysis &amp; vector ingestion planning
      </footer>
    </div>
  );
}
