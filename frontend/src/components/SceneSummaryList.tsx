import { useState } from "react";
import { ChevronDown, GitBranch, MapPin, Users } from "lucide-react";
import type { SceneSummary } from "../types/story";

function SceneCard({ scene }: { scene: SceneSummary }) {
  const [open, setOpen] = useState(true);
  const hasChoice = Boolean(scene.isChoicePoint && scene.choiceSummary);

  return (
    <article
      id={scene.id}
      className="rounded-xl border border-ink-200/80 bg-white shadow-card overflow-hidden animate-slide-up scroll-mt-24"
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-ink-50/60 transition-colors"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono text-ink-400">{scene.id}</span>
            {scene.chapter != null && (
              <span className="badge bg-accent-light text-accent">Ch. {scene.chapter}</span>
            )}
            {scene.pathLabel && (
              <span className="badge bg-ink-100 text-ink-600">{scene.pathLabel}</span>
            )}
            {scene.isChoicePoint && (
              <span className="badge bg-amber-100 text-amber-800 inline-flex items-center gap-1">
                <GitBranch className="h-3 w-3" />
                Choice point
              </span>
            )}
          </div>
          <h3 className="mt-1 font-display text-lg font-semibold text-ink-950 truncate">
            {scene.title}
          </h3>
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-ink-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className={`px-5 pb-5 grid gap-4 sm:grid-cols-2 border-t border-ink-100 ${
            hasChoice ? "pt-4" : "pt-2"
          }`}
        >
          {hasChoice && (
            <div className="sm:col-span-2 mt-1 rounded-lg bg-amber-50/80 border border-amber-200/80 px-4 py-3">
              <p className="field-label mb-1">Choice (canonical path)</p>
              <p className="text-sm text-ink-800 leading-relaxed">{scene.choiceSummary}</p>
            </div>
          )}
          <Field
            label="Setting"
            icon={<MapPin className="h-3.5 w-3.5" />}
            value={scene.setting}
          />
          <Field label="POV" value={scene.pov} />
          <Field
            label="Characters"
            icon={<Users className="h-3.5 w-3.5" />}
            value={scene.characters?.join(", ") || "—"}
          />
          <Field label="Plot beat" value={scene.plotBeat} className="sm:col-span-2" />
          <Field label="Conflict" value={scene.conflict} />
          <Field label="Tone" value={scene.tone} />
          <Field label="Relationship beats" value={scene.relationshipBeats} className="sm:col-span-2" />
          {scene.openThreads?.length > 0 && (
            <div className="sm:col-span-2">
              <p className="field-label mb-2">Open threads</p>
              <ul className="space-y-1.5">
                {scene.openThreads.map((t, i) => (
                  <li
                    key={i}
                    className="text-sm text-ink-700 pl-3 border-l-2 border-accent-muted"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function Field({
  label,
  value,
  icon,
  className = "",
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="field-label mb-1 flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      <p className="text-sm text-ink-800 leading-relaxed">{value || "—"}</p>
    </div>
  );
}

export function SceneSummaryList({ scenes }: { scenes: SceneSummary[] }) {
  if (!scenes.length) {
    return <Empty message="No scenes detected in this manuscript." />;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-600">
        {scenes.length} scene{scenes.length !== 1 ? "s" : ""} extracted — expand each card for full detail.
      </p>
      {scenes.map((scene) => (
        <SceneCard key={scene.id} scene={scene} />
      ))}
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <p className="text-center py-12 text-ink-500 text-sm">{message}</p>
  );
}
