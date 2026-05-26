import json
import os

from openai import OpenAI

from services.names import extract_script_name_context, sanitize_analysis_names

ANALYSIS_MODES = ("linear_choice_1", "full_branching")

NAME_RULES = """
INTERACTIVE SCRIPT NAMES (critical):
- Manuscripts often use variable tokens (#myname#, #fname#, {playername}) for the reader-chosen protagonist.
- NEVER put raw placeholder tokens in characters[], pair, or notes (wrong: "#myname# Hayes → Nicolas").
- Resolve the protagonist as "You (Surname)" when a fixed surname follows #myname# (e.g. "#myname# Hayes" → "You (Hayes)"); use "You" if no surname is known.
- Use full real names only for non-variable characters (e.g. Nicolas Lockwood).
- In relationship pair use format: "You (Hayes) → Nicolas Lockwood" not "#myname# Hayes → ...".
"""

SYSTEM_PROMPT_LINEAR = """You are a literary analyst building a RAG system for interactive fiction.

The input may be a branching script (multiple reader choices). For this analysis, use a
single canonical linear path: follow Choice 1 / the default branch when branches exist.
Mention other branches only briefly at choice points; do not fully analyze every path.

Segment the canonical path into scenes. Tag choice points with isChoicePoint true and a
choiceSummary explaining which option was followed (Choice 1 / default). Set pathLabel
on each scene (e.g. "choice-1 / main").

Identify patterns and relationship progression along that path only.
Recommend vector-DB chunking for scene-level nodes on the canonical path, with metadata for
later expansion to multi-branch storage.
""" + NAME_RULES + """
Return structured JSON only — no markdown fences. Ground all observations in the text."""

SYSTEM_PROMPT_BRANCHING = """You are a literary analyst building a RAG system for interactive fiction.

The input is a branching narrative script. Analyze the full branch structure: treat each
distinct scene node on any path as worth cataloguing. Identify choice points, alternate paths,
and how relationship arcs may diverge by branch.

Recommend vector-DB storage as a narrative graph (nodes + edges or path_ids), not a single
collapsed timeline.

""" + NAME_RULES + """
Return structured JSON only — no markdown fences. Ground all observations in the text."""

USER_PROMPT_TEMPLATE = """Analyze this fiction manuscript and return JSON matching this exact schema.

SCRIPT NAME CONTEXT (from preprocessor):
{script_name_context}

Analysis mode for this run: {analysis_mode}

{{
  "storyTitle": "string — inferred title or 'Untitled'",
  "analysisMode": "{analysis_mode}",
  "canonicalPathNote": "how branching was handled (e.g. linearized via Choice 1; N choice points detected)",
  "scenes": [
    {{
      "id": "scene-1",
      "chapter": 1,
      "pathLabel": "choice-1 / main",
      "isChoicePoint": false,
      "choiceSummary": null,
      "title": "short scene label",
      "setting": "where/when",
      "pov": "narrative POV",
      "characters": ["name1", "name2"],
      "plotBeat": "what happens",
      "conflict": "tension or obstacle",
      "relationshipBeats": "character relationship changes",
      "tone": "mood/style",
      "openThreads": ["unresolved hooks"]
    }}
  ],
  "patterns": [
    {{
      "id": "pattern-1",
      "name": "pattern name derived from text",
      "description": "how it appears in this story",
      "evidenceSceneIds": ["scene-1"]
    }}
  ],
  "outline": {{
    "premise": "one-paragraph story premise along the analyzed path(s)",
    "chapterOutline": "high-level chapter/scene structure",
    "sceneBeats": "key beats for opening scenes",
    "canonicalPathNote": "same as root canonicalPathNote or path-specific detail"
  }},
  "retrievedExamples": [
    {{
      "label": "Similar structural example",
      "snippet": "brief outline-style snippet this story resembles"
    }}
  ],
  "relationships": [
    {{
      "chapterOrScene": "Ch1 / Scene 1",
      "pair": "You (Surname) → Full Name (no #myname# tokens)",
      "trust": "low|medium|high",
      "tension": "low|medium|high",
      "intimacy": "low|medium|high",
      "notes": "relationship state notes on the analyzed path"
    }}
  ],
  "ingestion": {{
    "chunkLevel": "recommended chunk granularity (e.g. scene node on canonical path)",
    "metadataFields": ["story_id", "scene_id", "chapter", "path_id", "is_choice_point", "characters"],
    "embedWhat": ["what to embed in vector DB"],
    "optionalLater": ["alternate branches as separate path_id", "choice-level embeddings", "graph edges parent→child"]
  }}
}}

TEXT TO ANALYZE:
---
{text}
---"""

MAX_CHARS = 120_000


def _truncate(text: str) -> str:
    if len(text) <= MAX_CHARS:
        return text
    return text[:MAX_CHARS] + "\n\n[... truncated for analysis ...]"


def _resolve_mode(mode: str | None) -> str:
    if mode and mode in ANALYSIS_MODES:
        return mode
    return "linear_choice_1"


def analyze_fiction(
    text: str,
    api_key: str,
    analysis_mode: str | None = None,
) -> dict:
    mode = _resolve_mode(analysis_mode)
    system_prompt = (
        SYSTEM_PROMPT_BRANCHING
        if mode == "full_branching"
        else SYSTEM_PROMPT_LINEAR
    )

    client = OpenAI(api_key=api_key)
    truncated = _truncate(text)

    name_ctx = extract_script_name_context(truncated)
    script_name_context = json.dumps(name_ctx, indent=2)

    user_content = USER_PROMPT_TEMPLATE.format(
        text=truncated,
        analysis_mode=mode,
        script_name_context=script_name_context,
    )

    response = client.chat.completions.create(
        model=os.getenv("OPENAI_MODEL", "gpt-5.5"),
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        temperature=1.0,
    )

    raw = response.choices[0].message.content or "{}"
    data = json.loads(raw)
    data = _normalize(data, mode)
    return sanitize_analysis_names(data, truncated)


def _normalize(data: dict, mode: str) -> dict:
    """Ensure required keys exist with safe defaults."""
    data.setdefault("storyTitle", "Untitled")
    data.setdefault("analysisMode", mode)
    data.setdefault("canonicalPathNote", "")
    data.setdefault("scenes", [])
    data.setdefault("patterns", [])
    data.setdefault("outline", {
        "premise": "",
        "chapterOutline": "",
        "sceneBeats": "",
        "canonicalPathNote": "",
    })
    data.setdefault("retrievedExamples", [])
    data.setdefault("relationships", [])
    data.setdefault("ingestion", {
        "chunkLevel": "",
        "metadataFields": [],
        "embedWhat": [],
        "optionalLater": [],
    })

    if not data.get("canonicalPathNote") and data["outline"].get("canonicalPathNote"):
        data["canonicalPathNote"] = data["outline"]["canonicalPathNote"]

    default_path = "choice-1 / main" if mode == "linear_choice_1" else "multi-branch"

    for i, scene in enumerate(data["scenes"]):
        scene.setdefault("id", f"scene-{i + 1}")
        scene.setdefault("pathLabel", default_path)
        scene.setdefault("isChoicePoint", False)
        scene.setdefault("choiceSummary", None)
        scene.setdefault("openThreads", [])

    for i, pattern in enumerate(data["patterns"]):
        pattern.setdefault("id", f"pattern-{i + 1}")
        pattern.setdefault("evidenceSceneIds", [])

    outline = data["outline"]
    outline.setdefault("canonicalPathNote", data["canonicalPathNote"])

    return data
