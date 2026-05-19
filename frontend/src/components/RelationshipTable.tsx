import { Heart } from "lucide-react";
import { LevelBadge } from "./LevelBadge";
import type { RelationshipRow } from "../types/trial";

export function RelationshipTable({ rows }: { rows: RelationshipRow[] }) {
  if (!rows.length) {
    return (
      <p className="text-center py-12 text-ink-500 text-sm">
        No relationship progression data for this excerpt.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-ink-200/80 bg-white shadow-card">
      <div className="flex items-center gap-2 border-b border-ink-100 bg-ink-50/50 px-5 py-4">
        <Heart className="h-4 w-4 text-accent" />
        <h3 className="font-display font-semibold text-ink-950">
          Relationship progression
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left">
              <th className="px-5 py-3 field-label">Chapter / scene</th>
              <th className="px-5 py-3 field-label">Pair</th>
              <th className="px-5 py-3 field-label">Trust</th>
              <th className="px-5 py-3 field-label">Tension</th>
              <th className="px-5 py-3 field-label">Intimacy</th>
              <th className="px-5 py-3 field-label">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-ink-50 last:border-0 hover:bg-ink-50/40 transition-colors"
              >
                <td className="px-5 py-3 font-medium text-ink-900 whitespace-nowrap">
                  {row.chapterOrScene}
                </td>
                <td className="px-5 py-3 text-ink-800">{row.pair}</td>
                <td className="px-5 py-3">
                  <LevelBadge value={row.trust} />
                </td>
                <td className="px-5 py-3">
                  <LevelBadge value={row.tension} />
                </td>
                <td className="px-5 py-3">
                  <LevelBadge value={row.intimacy} />
                </td>
                <td className="px-5 py-3 text-ink-600 max-w-xs">{row.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
