import { AlertCircle, CheckCircle2, FileText } from "lucide-react";
import type { BatchStoryResult, CorpusEntry } from "../types/story";

type Props = {
  corpus: CorpusEntry[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  batchFailures?: BatchStoryResult[];
};

export function CorpusStoryPicker({
  corpus,
  selectedIndex,
  onSelect,
  batchFailures = [],
}: Props) {
  if (corpus.length <= 1 && batchFailures.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-card space-y-4">
      {corpus.length > 1 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">
            Corpus ({corpus.length} stories)
          </p>
          <div
            className="flex flex-wrap gap-2"
            role="tablist"
            aria-label="Stories in corpus"
          >
            {corpus.map((entry, index) => {
              const active = index === selectedIndex;
              const stored = Boolean(
                entry.data.pinecone?.upserted && entry.data.pinecone.upserted > 0
              );
              return (
                <button
                  key={`${entry.fileName}-${entry.data.storyId ?? index}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onSelect(index)}
                  className={`
                    inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all
                    ${
                      active
                        ? "bg-ink-950 text-white shadow-md"
                        : "bg-ink-50 text-ink-700 border border-ink-200 hover:bg-ink-100"
                    }
                  `}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 opacity-80" />
                  <span className="max-w-[12rem] truncate">
                    {entry.data.storyTitle}
                  </span>
                  {stored && (
                    <CheckCircle2
                      className={`h-3.5 w-3.5 shrink-0 ${active ? "text-emerald-300" : "text-emerald-600"}`}
                      aria-label="Stored in Pinecone"
                    />
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-ink-500">
            Source: {corpus[selectedIndex]?.fileName}
          </p>
        </div>
      )}

      {batchFailures.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-3 space-y-2">
          <p className="text-sm font-medium text-amber-900 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {batchFailures.length} file
            {batchFailures.length === 1 ? "" : "s"} could not be analyzed
          </p>
          <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
            {batchFailures.map((f) => (
              <li key={f.fileName}>
                <span className="font-medium">{f.fileName}</span>
                {f.error ? ` — ${f.error}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
