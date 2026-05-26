import { GitBranch } from "lucide-react";
import type { NarrativePattern } from "../types/story";

export function NarrativePatternsPanel({
  patterns,
  onSceneClick,
}: {
  patterns: NarrativePattern[];
  onSceneClick?: (sceneId: string) => void;
}) {
  if (!patterns.length) {
    return (
      <p className="text-center py-12 text-ink-500 text-sm">
        No recurring patterns identified yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-600">
        Patterns discovered from the text — not manually predefined tropes.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {patterns.map((p) => (
          <article
            key={p.id}
            className="rounded-xl border border-ink-200/80 bg-white p-5 shadow-card animate-slide-up"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-light text-accent">
                <GitBranch className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="font-display font-semibold text-ink-950">{p.name}</h3>
                <p className="mt-2 text-sm text-ink-700 leading-relaxed">{p.description}</p>
                {p.evidenceSceneIds?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="text-xs text-ink-500 mr-1">Seen in:</span>
                    {p.evidenceSceneIds.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onSceneClick?.(id)}
                        className="badge bg-ink-100 text-ink-700 hover:bg-accent-light hover:text-accent transition-colors cursor-pointer"
                      >
                        {id}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
