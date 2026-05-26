import { useRef, useState } from "react";
import {
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";

type Props = {
  file: File | null;
  lastFileName: string | null;
  lastFileSize: number | null;
  onFileChange: (file: File | null) => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  onGenerate: () => void;
  onClear: () => void;
  isLoading: boolean;
  error: string | null;
  canClear: boolean;
};

export function UploadPanel({
  file,
  lastFileName,
  lastFileSize,
  onFileChange,
  apiKey,
  onApiKeyChange,
  onGenerate,
  onClear,
  isLoading,
  error,
  canClear,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const displayName = file?.name ?? lastFileName;
  const displaySize = file?.size ?? lastFileSize;
  const hasFileDisplay = Boolean(displayName);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type === "application/pdf") {
      onFileChange(dropped);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) onFileChange(selected);
  };

  return (
    <section className="rounded-2xl border border-ink-200/80 bg-white shadow-card overflow-hidden">
      <div className="border-b border-ink-100 bg-gradient-to-r from-ink-50 to-accent-light/30 px-6 py-5">
        <h2 className="font-display text-xl font-semibold text-ink-950">
          Analyze your manuscript
        </h2>
        <p className="mt-1 text-sm text-ink-600">
          Upload a fiction PDF. We extract scenes, narrative patterns, an
          editable outline, relationship arcs, and RAG ingestion recommendations.
        </p>
      </div>

      <div className="p-6 space-y-5">
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`
            relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed
            px-6 py-10 transition-all cursor-pointer
            ${
              dragOver
                ? "border-accent bg-accent-light/50 scale-[1.01]"
                : hasFileDisplay
                  ? "border-emerald-300 bg-emerald-50/40"
                  : "border-ink-200 hover:border-ink-300 hover:bg-ink-50/50"
            }
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="sr-only"
            onChange={handleFileInput}
          />

          {hasFileDisplay ? (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <FileText className="h-6 w-6" />
              </div>
              <p className="mt-3 font-medium text-ink-900">{displayName}</p>
              <p className="text-sm text-ink-500">
                {displaySize != null
                  ? `${(displaySize / 1024).toFixed(1)} KB · PDF ready`
                  : "PDF"}
                {!file && lastFileName && (
                  <span className="block text-xs text-ink-400 mt-0.5">
                    Restored from last session — re-upload to run again
                  </span>
                )}
              </p>
              {file && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFileChange(null);
                  }}
                  className="mt-3 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-accent transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  Remove file
                </button>
              )}
            </>
          ) : (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-100 text-ink-600">
                <Upload className="h-6 w-6" />
              </div>
              <p className="mt-3 font-medium text-ink-900">
                Drop your PDF here or click to browse
              </p>
              <p className="text-sm text-ink-500">Text-based PDF · max 20 MB</p>
            </>
          )}
        </div>

        <div>
          <label
            htmlFor="api-key"
            className="flex items-center gap-2 field-label mb-2"
          >
            <KeyRound className="h-3.5 w-3.5" />
            OpenAI API key
          </label>
          <div className="relative">
            <input
              id="api-key"
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder="sk-… (optional if set on server)"
              autoComplete="off"
              className="w-full rounded-xl border border-ink-200 bg-ink-50/50 px-4 py-3 pr-12 text-sm
                placeholder:text-ink-400 focus:border-accent focus:bg-white focus:outline-none
                focus:ring-2 focus:ring-accent/20 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink-400 hover:text-ink-700 transition-colors"
              aria-label={showKey ? "Hide API key" : "Show API key"}
            >
              {showKey ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-ink-500">
            Sent securely to the backend for this request only — never stored.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 animate-fade-in"
          >
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onGenerate}
            disabled={!file || isLoading}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5
              text-sm font-semibold text-white shadow-md
              hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed
              transition-all active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-accent/40 focus:ring-offset-2"
          >
            {isLoading ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Analyzing manuscript…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate analysis
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClear}
            disabled={!canClear || isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-ink-200 bg-white px-5 py-3.5
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
