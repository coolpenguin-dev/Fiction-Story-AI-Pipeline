import { Database, Layers, Sparkles } from "lucide-react";
import type { IngestionRecommendation } from "../types/trial";

function ListBlock({
  title,
  items,
  icon,
}: {
  title: string;
  items: string[];
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-ink-200/80 bg-white p-5 shadow-card">
      <h3 className="flex items-center gap-2 font-display font-semibold text-ink-950">
        <span className="text-accent">{icon}</span>
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-ink-500">—</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-sm text-ink-700"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function IngestionPanel({ ingestion }: { ingestion: IngestionRecommendation }) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-accent-muted bg-gradient-to-br from-accent-light/60 to-white p-6 shadow-card">
        <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-ink-950">
          <Database className="h-5 w-5 text-accent" />
          Recommended chunk level
        </h3>
        <p className="mt-3 text-sm text-ink-800 leading-relaxed">
          {ingestion.chunkLevel || "Not specified"}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <ListBlock
          title="Metadata fields"
          items={ingestion.metadataFields}
          icon={<Layers className="h-4 w-4" />}
        />
        <ListBlock
          title="What to embed"
          items={ingestion.embedWhat}
          icon={<Sparkles className="h-4 w-4" />}
        />
        <ListBlock
          title="Defer to v2"
          items={ingestion.optionalLater}
          icon={<Database className="h-4 w-4" />}
        />
      </div>
    </div>
  );
}
