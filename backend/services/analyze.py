import json
import os
from openai import OpenAI

SYSTEM_PROMPT = """You are a literary analyst helping build a fiction-writing RAG system.
Analyze the provided fiction text and return structured JSON only — no markdown fences.

Segment the text into logical scenes (use scene breaks, chapter markers, or narrative shifts).
Identify recurring narrative patterns from the text itself (do not rely on generic trope labels unless evident).
Sketch relationship progression across the story.
Recommend what to chunk and embed for a vector database.

Be specific and ground every observation in the actual text provided."""

USER_PROMPT_TEMPLATE = """Analyze this fiction manuscript excerpt and return JSON matching this exact schema:

{{
  "storyTitle": "string — inferred title or 'Untitled'",
  "scenes": [
    {{
      "id": "scene-1",
      "chapter": 1,
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
    "premise": "one-paragraph story premise",
    "chapterOutline": "high-level chapter/scene structure",
    "sceneBeats": "key beats for opening scenes"
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
      "pair": "Character A → Character B",
      "trust": "low|medium|high",
      "tension": "low|medium|high",
      "intimacy": "low|medium|high",
      "notes": "relationship state notes"
    }}
  ],
  "ingestion": {{
    "chunkLevel": "recommended chunk granularity",
    "metadataFields": ["field1", "field2"],
    "embedWhat": ["what to embed in vector DB"],
    "optionalLater": ["deferred for v2"]
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


def analyze_fiction(text: str, api_key: str) -> dict:
    client = OpenAI(api_key=api_key)
    truncated = _truncate(text)

    response = client.chat.completions.create(
        model=os.getenv("OPENAI_MODEL", "gpt-5.5"),
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": USER_PROMPT_TEMPLATE.format(text=truncated),
            },
        ],
        temperature = 1.0,
    )

    raw = response.choices[0].message.content or "{}"
    data = json.loads(raw)
    return _normalize(data)


def _normalize(data: dict) -> dict:
    """Ensure required keys exist with safe defaults."""
    data.setdefault("storyTitle", "Untitled")
    data.setdefault("scenes", [])
    data.setdefault("patterns", [])
    data.setdefault("outline", {
        "premise": "",
        "chapterOutline": "",
        "sceneBeats": "",
    })
    data.setdefault("retrievedExamples", [])
    data.setdefault("relationships", [])
    data.setdefault("ingestion", {
        "chunkLevel": "",
        "metadataFields": [],
        "embedWhat": [],
        "optionalLater": [],
    })

    for i, scene in enumerate(data["scenes"]):
        scene.setdefault("id", f"scene-{i + 1}")
        scene.setdefault("openThreads", [])

    for i, pattern in enumerate(data["patterns"]):
        pattern.setdefault("id", f"pattern-{i + 1}")
        pattern.setdefault("evidenceSceneIds", [])

    return data
