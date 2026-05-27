import type { RetrievalPreferences } from "../types/story";

type Props = {
  prefs: RetrievalPreferences;
  onChange: (prefs: RetrievalPreferences) => void;
};

export function RetrievalControls({ prefs, onChange }: Props) {
  return (
    <div className="rounded-lg border border-ink-200/80 bg-white p-3 space-y-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
          Match source
        </p>
        <div className="flex rounded-lg border border-ink-200 p-0.5 bg-ink-50/50">
          <button
            type="button"
            onClick={() => onChange({ ...prefs, crossStory: true })}
            className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors ${
              prefs.crossStory
                ? "bg-white text-ink-950 shadow-sm"
                : "text-ink-500 hover:text-ink-800"
            }`}
          >
            Cross-story
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...prefs, crossStory: false })}
            className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors ${
              !prefs.crossStory
                ? "bg-white text-ink-950 shadow-sm"
                : "text-ink-500 hover:text-ink-800"
            }`}
          >
            Same story
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-ink-500 leading-snug">
          {prefs.crossStory
            ? "Matches come from other manuscripts in your corpus (RAG inspiration)."
            : "Compare your outline to scenes from this story's analyzed path."}
        </p>
      </div>

      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={prefs.minScore > 0}
            onChange={(e) =>
              onChange({
                ...prefs,
                minScore: e.target.checked ? 0.4 : 0,
              })
            }
            className="rounded border-ink-300 text-accent focus:ring-accent/30"
          />
          <span className="text-[11px] text-ink-700">
            Hide weak matches (&lt;40% similarity)
          </span>
        </label>
      </div>
    </div>
  );
}
