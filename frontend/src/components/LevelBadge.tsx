type Level = "low" | "medium" | "high" | string;

export function LevelBadge({ value }: { value: Level }) {
  const v = String(value).toLowerCase();
  const cls =
    v === "high"
      ? "badge-high"
      : v === "medium"
        ? "badge-medium"
        : "badge-low";
  return <span className={`badge ${cls}`}>{value}</span>;
}
