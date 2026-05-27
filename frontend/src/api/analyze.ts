import type {
  AnalysisMode,
  BatchAnalyzeResponse,
  StoryAnalysis,
} from "../types/story";

function apiUrl(path: string): string {
  const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
  return `${base}${path}`;
}

function parseErrorBody(body: unknown, status: number): string {
  const detail = (body as { detail?: unknown })?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => (d as { msg?: string }).msg).join(", ");
  }
  return `Request failed (${status})`;
}

export async function analyzePdf(
  file: File,
  analysisMode: AnalysisMode = "linear_choice_1"
): Promise<StoryAnalysis> {
  const form = new FormData();
  form.append("file", file);
  form.append("analysis_mode", analysisMode);
  form.append("persist_to_pinecone", "true");

  const res = await fetch(apiUrl("/api/analyze"), {
    method: "POST",
    body: form,
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(parseErrorBody(body, res.status));
  }

  return body as StoryAnalysis;
}

export async function analyzePdfBatch(
  files: File[],
  analysisMode: AnalysisMode = "linear_choice_1"
): Promise<BatchAnalyzeResponse> {
  const form = new FormData();
  for (const file of files) {
    form.append("files", file);
  }
  form.append("analysis_mode", analysisMode);
  form.append("persist_to_pinecone", "true");

  const res = await fetch(apiUrl("/api/analyze-batch"), {
    method: "POST",
    body: form,
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(parseErrorBody(body, res.status));
  }

  return body as BatchAnalyzeResponse;
}
