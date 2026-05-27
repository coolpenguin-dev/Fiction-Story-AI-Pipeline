import os
from typing import Any, Literal

from openai import OpenAI

from services.openai_retry import call_with_retry
from services.retrieve import retrieve_from_outline

GenerationMode = Literal[
    "premise",
    "chapter_outline",
    "scene_beats",
    "opening_draft",
    "chapter_beats",
]

SYSTEM_PROMPT = """You are a fiction writing assistant for interactive / branching manuscripts.

You help authors draft new material using:
1) Their editable outline (premise, chapter structure, scene beats)
2) Retrieved reference scenes from other stories in a vector corpus (for structure, tone, and pacing — NOT plot copying)

Rules:
- Honor the author's outline characters, setting, and emotional arc.
- Use corpus references only as craft inspiration (beat rhythm, relationship escalation, POV handling).
- Do NOT import characters, names, or plot events from reference stories.
- Write in the same narrative mode implied by the outline (e.g. third-person literary vs second-person interactive).
- Output plain text or markdown only — no JSON fences unless asked."""

USER_TEMPLATE_PREMISE = """Write or refine a one-paragraph story premise for the manuscript below.

One paragraph only. Capture core conflict, emotional promise, and protagonist situation.

STORY TITLE: {story_title}

CURRENT PREMISE (author draft — improve or replace):
{premise}

CORPUS REFERENCE SCENES (tone/structure inspiration only — do not copy plot):
{references}

Return the premise paragraph only."""

USER_TEMPLATE_CHAPTER_OUTLINE = """Expand the premise into a chapter-level outline.

Use numbered chapters (Chapter 1, Chapter 2, …). One or two sentences per chapter describing the arc beat.

STORY TITLE: {story_title}

PREMISE:
{premise}

CURRENT CHAPTER OUTLINE (author draft — improve or replace):
{chapter_outline}

CORPUS REFERENCE SCENES (pacing inspiration only — do not copy plot):
{references}

Return the chapter outline only."""

USER_TEMPLATE_SCENE_BEATS = """Write granular opening-scene beats for the story below.

Use numbered scenes or bullet beats for the opening act (typically 3–8 beats). Actionable for drafting.

STORY TITLE: {story_title}

PREMISE:
{premise}

CHAPTER OUTLINE:
{chapter_outline}

CURRENT SCENE BEATS (author draft — improve or replace):
{scene_beats}

CORPUS REFERENCE SCENES (beat rhythm inspiration only — do not copy plot):
{references}

Return the scene beats only."""

USER_TEMPLATE_CHAPTER_BEATS = """Generate detailed chapter beats for the story below.

Return numbered chapters with 3–6 bullet beats each. Keep beats actionable for drafting.

STORY TITLE: {story_title}

AUTHOR OUTLINE
Premise:
{premise}

Chapter outline:
{chapter_outline}

Opening scene beats:
{scene_beats}

CORPUS REFERENCE SCENES (structure/tone inspiration only — do not copy plot):
{references}

Write chapter beats that expand the author's outline into a clear drafting roadmap."""

USER_TEMPLATE_OPENING_DRAFT = """Write an opening-scene prose draft (~600–900 words) for the story below.

Ground the draft in the opening scene beats. End on a beat that invites the next scene.

STORY TITLE: {story_title}

AUTHOR OUTLINE
Premise:
{premise}

Chapter outline:
{chapter_outline}

Opening scene beats:
{scene_beats}

CORPUS REFERENCE SCENES (craft inspiration only — do not copy plot or characters):
{references}

Write the opening draft now."""

MAX_REFERENCE_SCENES = 5

_TEMPLATES: dict[GenerationMode, str] = {
    "premise": USER_TEMPLATE_PREMISE,
    "chapter_outline": USER_TEMPLATE_CHAPTER_OUTLINE,
    "scene_beats": USER_TEMPLATE_SCENE_BEATS,
    "chapter_beats": USER_TEMPLATE_CHAPTER_BEATS,
    "opening_draft": USER_TEMPLATE_OPENING_DRAFT,
}


def _format_references(scenes: list[dict[str, Any]]) -> str:
    if not scenes:
        return "(No corpus matches retrieved — rely on the outline only.)"

    blocks: list[str] = []
    for i, scene in enumerate(scenes[:MAX_REFERENCE_SCENES], start=1):
        title = scene.get("storyTitle") or scene.get("label") or "Reference"
        scene_id = scene.get("sceneId") or ""
        score = scene.get("score")
        score_text = f" · similarity {round(float(score) * 100)}%" if score is not None else ""
        snippet = (scene.get("snippet") or "").strip()
        header = f"[{i}] {title}"
        if scene_id:
            header += f" ({scene_id}{score_text})"
        blocks.append(f"{header}\n{snippet or 'No details.'}")
    return "\n\n---\n\n".join(blocks)


def _resolve_retrieved_scenes(
    *,
    premise: str,
    chapter_outline: str,
    scene_beats: str,
    retrieved_scenes: list[dict[str, Any]] | None,
    exclude_story_id: str | None,
    top_k: int,
) -> tuple[list[dict[str, Any]], dict[str, Any] | None]:
    if retrieved_scenes:
        cleaned = [s for s in retrieved_scenes if isinstance(s, dict)][:MAX_REFERENCE_SCENES]
        return cleaned, None

    retrieval = retrieve_from_outline(
        premise=premise,
        chapter_outline=chapter_outline,
        scene_beats=scene_beats,
        top_k=top_k,
        exclude_story_id=exclude_story_id,
    )
    results = retrieval.get("results") or []
    if not isinstance(results, list):
        results = []
    return results, retrieval


def _validate_mode_inputs(mode: GenerationMode, story_title: str, premise: str, chapter_outline: str, scene_beats: str) -> str | None:
    title = story_title.strip()
    if mode == "premise":
        if not title and not premise.strip():
            return "Add a story title or seed premise before generating."
        return None
    if mode == "chapter_outline" and not premise.strip():
        return "Complete and approve the premise step before generating chapters."
    if mode in ("scene_beats", "chapter_beats") and not chapter_outline.strip() and not premise.strip():
        return "Add a chapter outline or premise before generating scene beats."
    if mode == "opening_draft" and not scene_beats.strip() and not chapter_outline.strip():
        return "Add scene beats or a chapter outline before generating the opening draft."
    return None


def generate_from_outline(
    *,
    mode: GenerationMode,
    api_key: str,
    story_title: str = "",
    premise: str = "",
    chapter_outline: str = "",
    scene_beats: str = "",
    retrieved_scenes: list[dict[str, Any]] | None = None,
    exclude_story_id: str | None = None,
    top_k: int = 5,
) -> dict[str, Any]:
    validation_error = _validate_mode_inputs(
        mode, story_title, premise, chapter_outline, scene_beats
    )
    if validation_error:
        return {
            "ok": False,
            "mode": mode,
            "content": "",
            "error": validation_error,
            "retrievalUsed": [],
        }

    scenes, retrieval_meta = _resolve_retrieved_scenes(
        premise=premise,
        chapter_outline=chapter_outline,
        scene_beats=scene_beats,
        retrieved_scenes=retrieved_scenes,
        exclude_story_id=exclude_story_id,
        top_k=top_k,
    )

    references = _format_references(scenes)
    template = _TEMPLATES.get(mode, USER_TEMPLATE_CHAPTER_BEATS)
    user_content = template.format(
        story_title=story_title.strip() or "Untitled",
        premise=premise.strip() or "(not provided yet)",
        chapter_outline=chapter_outline.strip() or "(not provided yet)",
        scene_beats=scene_beats.strip() or "(not provided yet)",
        references=references,
    )

    timeout = float(os.getenv("OPENAI_TIMEOUT", "300"))
    client = OpenAI(api_key=api_key, timeout=timeout)
    model = os.getenv("OPENAI_MODEL", "gpt-5.5")

    try:
        response = call_with_retry(
            lambda: client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_content},
                ],
                temperature=1.0,
            ),
            label="RAG generation",
        )
        content = (response.choices[0].message.content or "").strip()
    except Exception as e:
        return {
            "ok": False,
            "mode": mode,
            "content": "",
            "error": str(e),
            "retrievalUsed": _summarize_retrieval(scenes),
            "retrieval": retrieval_meta,
        }

    if not content:
        return {
            "ok": False,
            "mode": mode,
            "content": "",
            "error": "Model returned empty content.",
            "retrievalUsed": _summarize_retrieval(scenes),
            "retrieval": retrieval_meta,
        }

    return {
        "ok": True,
        "mode": mode,
        "content": content,
        "retrievalUsed": _summarize_retrieval(scenes),
        "retrieval": retrieval_meta,
    }


def _summarize_retrieval(scenes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    summary: list[dict[str, Any]] = []
    for scene in scenes[:MAX_REFERENCE_SCENES]:
        summary.append(
            {
                "storyId": scene.get("storyId"),
                "storyTitle": scene.get("storyTitle"),
                "sceneId": scene.get("sceneId"),
                "score": scene.get("score"),
                "sourceFileName": scene.get("sourceFileName"),
            }
        )
    return summary
