import { ChevronDown, ChevronUp, Heart, Sparkles } from "lucide-react";
import { useState } from "react";
import type { StoryState } from "../types/story";
import { hasStoryStateContent } from "../lib/storyState";

type Props = {
  storyState: StoryState;
};

export function StoryStatePanel({ storyState }: Props) {
  const [open, setOpen] = useState(true);

  if (!hasStoryStateContent(storyState)) {
    return (
      <div className="rounded-lg border border-ink-200/80 bg-white/80 px-3 py-2.5 text-[11px] text-ink-500">
        No story state from analysis yet — re-analyze to extract patterns and arcs.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-violet-200/80 bg-violet-50/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-violet-50/80"
      >
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-900">
          <Sparkles className="h-3.5 w-3.5" />
          Story state
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] text-violet-700">
          Passed to every generate step
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </span>
      </button>

      {open && (
        <div className="border-t border-violet-200/60 px-3 py-2.5 space-y-2.5 text-[11px] text-violet-950">
          {storyState.characters.length > 0 && (
            <p>
              <span className="font-semibold text-violet-800">Characters: </span>
              {storyState.characters.join(", ")}
            </p>
          )}

          {storyState.patterns.length > 0 && (
            <div>
              <p className="font-semibold text-violet-800 mb-1">Patterns</p>
              <ul className="space-y-1">
                {storyState.patterns.map((p) => (
                  <li key={p.name} className="leading-snug">
                    <span className="font-medium">{p.name}</span>
                    {p.description ? ` — ${p.description}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {storyState.relationships.length > 0 && (
            <div>
              <p className="font-semibold text-violet-800 mb-1 inline-flex items-center gap-1">
                <Heart className="h-3 w-3" />
                Relationships
              </p>
              <ul className="space-y-1">
                {storyState.relationships.slice(0, 4).map((row) => (
                  <li key={`${row.pair}-${row.chapterOrScene}`} className="leading-snug">
                    <span className="font-medium">{row.pair}</span>
                    {row.chapterOrScene ? ` (${row.chapterOrScene})` : ""}
                    {(row.trust || row.tension || row.intimacy) && (
                      <span className="text-violet-700">
                        {" "}
                        · trust {row.trust || "—"}, tension {row.tension || "—"}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {storyState.openThreads.length > 0 && (
            <div>
              <p className="font-semibold text-violet-800 mb-1">Open threads</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {storyState.openThreads.slice(0, 4).map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          )}

          {storyState.sceneCount > 0 && (
            <p className="text-violet-700">
              Canonical path: {storyState.sceneCount} analyzed scene
              {storyState.sceneCount === 1 ? "" : "s"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
