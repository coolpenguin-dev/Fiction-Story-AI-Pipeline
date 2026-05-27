import { useRef, useState } from "react";
import {
  FileText,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { MAX_CORPUS_FILES } from "../types/story";
import type { AnalyzeProgress } from "../types/story";

type Props = {
  files: File[];
  onFilesChange: (files: File[]) => void;
  onGenerate: () => void;
  onClear: () => void;
  isLoading: boolean;
  progress: AnalyzeProgress | null;
  error: string | null;
  canClear: boolean;
};

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Same footprint as the primary Analyze button (idle + loading). */
const PRIMARY_ACTION_CLASS =
  "flex-1 h-[3.25rem] rounded-xl px-6 shadow-md text-sm font-semibold";

export function UploadPanel({
  files,
  onFilesChange,
  onGenerate,
  onClear,
  isLoading,
  progress,
  error,
  canClear,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const atLimit = files.length >= MAX_CORPUS_FILES;

  const addPdfFiles = (incoming: FileList | File[]) => {
    const pdfs = Array.from(incoming).filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (pdfs.length === 0) return;

    const merged: File[] = [...files];
    for (const pdf of pdfs) {
      if (merged.length >= MAX_CORPUS_FILES) break;
      const duplicate = merged.some(
        (f) => f.name === pdf.name && f.size === pdf.size && f.lastModified === pdf.lastModified
      );
      if (!duplicate) merged.push(pdf);
    }
    onFilesChange(merged);
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addPdfFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addPdfFiles(e.target.files);
    e.target.value = "";
  };

  const hasFiles = files.length > 0;

  return (
    <section className="rounded-2xl border border-ink-200/80 bg-white shadow-card overflow-hidden">
      <div className="border-b border-ink-100 bg-gradient-to-r from-ink-50 to-accent-light/30 px-6 py-5">
        <h2 className="font-display text-xl font-semibold text-ink-950">
          Build your corpus
        </h2>
        <p className="mt-1 text-sm text-ink-600">
          Upload up to {MAX_CORPUS_FILES} fiction PDFs (choice-1 linearized scripts).
          Each story is analyzed and stored in Pinecone for retrieval.
        </p>
      </div>

      <div className="p-6 space-y-5">
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && !atLimit && inputRef.current?.click()}
          onClick={() => !atLimit && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            if (!atLimit) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={atLimit ? undefined : handleDrop}
          className={`
            relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed
            px-6 py-10 transition-all
            ${atLimit ? "cursor-not-allowed opacity-60" : "cursor-pointer"}
            ${
              dragOver
                ? "border-accent bg-accent-light/50 scale-[1.01]"
                : hasFiles
                  ? "border-emerald-300 bg-emerald-50/40"
                  : "border-ink-200 hover:border-ink-300 hover:bg-ink-50/50"
            }
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            multiple
            className="sr-only"
            disabled={atLimit}
            onChange={handleFileInput}
          />

          {hasFiles ? (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <FileText className="h-6 w-6" />
              </div>
              <p className="mt-3 font-medium text-ink-900">
                {files.length} PDF{files.length === 1 ? "" : "s"} selected
              </p>
              <p className="text-sm text-ink-500">
                {atLimit
                  ? `Maximum ${MAX_CORPUS_FILES} files for POC`
                  : "Drop more PDFs or click to add"}
              </p>
            </>
          ) : (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-100 text-ink-600">
                <Upload className="h-6 w-6" />
              </div>
              <p className="mt-3 font-medium text-ink-900">
                Drop PDFs here or click to browse
              </p>
              <p className="text-sm text-ink-500">
                Up to {MAX_CORPUS_FILES} files · text-based PDF · max 20 MB each
              </p>
            </>
          )}
        </div>

        {hasFiles && (
          <ul className="rounded-xl border border-ink-200 divide-y divide-ink-100 overflow-hidden">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${file.size}-${file.lastModified}`}
                className="flex items-center gap-3 px-4 py-3 bg-white"
              >
                <FileText className="h-4 w-4 shrink-0 text-ink-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink-900 truncate">{file.name}</p>
                  <p className="text-xs text-ink-500">{formatSize(file.size)}</p>
                </div>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => removeFile(index)}
                  className="p-1.5 text-ink-400 hover:text-red-600 transition-colors disabled:opacity-40"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 animate-fade-in"
          >
            {error}
          </div>
        )}

        <div className="flex gap-3 items-stretch">
          {isLoading && progress ? (
            <div
              className={`${PRIMARY_ACTION_CLASS} relative overflow-hidden bg-accent text-white`}
              aria-live="polite"
              aria-valuenow={progress.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Analyzing ${Math.min(progress.completed + 1, progress.total)} of ${progress.total}: ${progress.currentFileName}`}
              title={progress.currentFileName}
              role="progressbar"
            >
              <div
                className="absolute inset-y-0 left-0 bg-white/15 transition-all duration-500 ease-out"
                style={{ width: `${progress.percent}%` }}
              />
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                <div
                  className="h-full bg-white transition-all duration-500 ease-out"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <div className="relative z-10 flex h-full items-center justify-between gap-3">
                <span className="truncate">
                  Analyzing {Math.min(progress.completed + 1, progress.total)} of{" "}
                  {progress.total}
                </span>
                <span className="tabular-nums shrink-0">{progress.percent}%</span>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={onGenerate}
              disabled={files.length === 0 || isLoading}
              className={`${PRIMARY_ACTION_CLASS} inline-flex items-center justify-center gap-2 bg-accent text-white
                hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed
                transition-all active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-accent/40 focus:ring-offset-2`}
            >
              <Sparkles className="h-4 w-4 shrink-0" />
              {files.length <= 1
                ? "Analyze manuscript"
                : `Analyze ${files.length} manuscripts`}
            </button>
          )}

          <button
            type="button"
            onClick={onClear}
            disabled={!canClear || isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-ink-200 bg-white px-5 h-[3.25rem]
              text-sm font-semibold text-ink-700 shadow-sm
              hover:bg-ink-50 hover:border-ink-300 disabled:opacity-50 disabled:cursor-not-allowed
              transition-all focus:outline-none focus:ring-2 focus:ring-ink-200 focus:ring-offset-2"
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </button>
        </div>
      </div>
    </section>
  );
}
