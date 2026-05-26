import type { AnalysisMode, TrialData } from "../types/trial";

export async function analyzePdf(
  file: File,
  apiKey?: string,
  analysisMode: AnalysisMode = "linear_choice_1"
): Promise<TrialData> {
  const form = new FormData();
  form.append("file", file);
  form.append("analysis_mode", analysisMode);
  if (apiKey?.trim()) {
    form.append("openai_api_key", apiKey.trim());
  }

  const res = await fetch("/api/analyze", {
    method: "POST",
    body: form,
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      typeof body.detail === "string"
        ? body.detail
        : Array.isArray(body.detail)
          ? body.detail.map((d: { msg?: string }) => d.msg).join(", ")
          : `Request failed (${res.status})`;
    throw new Error(message);
  }

  return body as TrialData;
}
