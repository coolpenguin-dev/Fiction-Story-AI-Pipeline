import { useState } from "react";
import { BookOpen, Layers, ListTree, Save } from "lucide-react";
import type { OutlineDraft, RetrievedExample } from "../types/story";

type Props = {
  outline: OutlineDraft;
  retrievedExamples: RetrievedExample[];
  onChange: (outline: OutlineDraft) => void;
};

const FIELDS: {
  key: keyof OutlineDraft;
  label: string;
  icon: React.ReactNode;
  rows: number;
  hint: string;
}[] = [
  {
    key: "premise",
    label: "Premise",
    icon: <BookOpen className="h-4 w-4" />,
    rows: 4,
    hint: "High-level story hook — edit freely before the next generation step.",
  },
  {
    key: "chapterOutline",
    label: "Chapter outline",
    icon: <Layers className="h-4 w-4" />,
    rows: 6,
    hint: "Chapter-level structure pulled from patterns in your corpus.",
  },
  {
    key: "sceneBeats",
    label: "Scene beats",
    icon: <ListTree className="h-4 w-4" />,
    rows: 5,
    hint: "Granular beats for opening scenes — editable at every step in the full pipeline.",
  },
];

export function OutlineEditor({ outline, retrievedExamples, onChange }: Props) {
  const [saved, setSaved] = useState(false);

  const update = (key: keyof OutlineDraft, value: string) => {
    setSaved(false);
    onChange({ ...outline, [key]: value });
  };

  const handleSave = () => {
    localStorage.setItem("fiction-rag-outline", JSON.stringify(outline));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-5">
        <p className="text-sm text-ink-600">
          RAG-style outline — each field is editable. In production, your edits
          plus retrieved examples drive the next LLM pass.
        </p>

        {FIELDS.map(({ key, label, icon, rows, hint }) => (
          <div
            key={key}
            className="rounded-xl border border-ink-200/80 bg-white p-5 shadow-card"
          >
            <label
              htmlFor={key}
              className="flex items-center gap-2 font-display font-semibold text-ink-950"
            >
              <span className="text-accent">{icon}</span>
              {label}
            </label>
            <p className="mt-1 text-xs text-ink-500">{hint}</p>
            <textarea
              id={key}
              value={outline[key]}
              onChange={(e) => update(key, e.target.value)}
              rows={rows}
              className="mt-3 w-full rounded-lg border border-ink-200 bg-ink-50/30 px-4 py-3 text-sm text-ink-800
                leading-relaxed resize-y min-h-[80px]
                focus:border-accent focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
            />
          </div>
        ))}

        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium
            text-ink-800 hover:bg-ink-50 transition-colors"
        >
          <Save className="h-4 w-4" />
          {saved ? "Saved locally" : "Save edits to browser"}
        </button>
      </div>

      <aside className="space-y-4">
        <h3 className="font-display font-semibold text-ink-950">
          Retrieved examples
        </h3>
        <p className="text-xs text-ink-500">
          Similar structural snippets the full system would pull from your vector
          database.
        </p>
        {retrievedExamples.length === 0 ? (
          <p className="text-sm text-ink-500 italic">No examples returned.</p>
        ) : (
          retrievedExamples.map((ex, i) => (
            <div
              key={i}
              className="rounded-xl border border-dashed border-accent-muted bg-accent-light/40 p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                {ex.label}
              </p>
              <p className="mt-2 text-sm text-ink-700 leading-relaxed">{ex.snippet}</p>
            </div>
          ))
        )}
      </aside>
    </div>
  );
}
