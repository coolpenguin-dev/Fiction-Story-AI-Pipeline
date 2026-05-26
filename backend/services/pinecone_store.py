import os
import re
import uuid
from typing import Any

from openai import OpenAI
from pinecone import Pinecone


def _slugify(value: str) -> str:
    value = (value or "").strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-{2,}", "-", value).strip("-")
    return value or "story"


def build_story_id(story_title: str) -> str:
    return f"{_slugify(story_title)}-{uuid.uuid4().hex[:10]}"


def _get_pinecone_index() -> Any:
    api_key = os.getenv("PINECONE_API_KEY", "").strip()
    index_name = os.getenv("PINECONE_INDEX_NAME", "").strip()
    if not api_key or not index_name:
        raise RuntimeError("Pinecone not configured: set PINECONE_API_KEY and PINECONE_INDEX_NAME.")

    pc = Pinecone(api_key=api_key)

    # Prefer host targeting if provided; otherwise resolve via describe_index (fine for dev).
    host = os.getenv("PINECONE_INDEX_HOST", "").strip()
    if not host:
        desc = pc.describe_index(name=index_name)
        host = desc.get("host") if isinstance(desc, dict) else getattr(desc, "host", None)
    if not host:
        raise RuntimeError("Could not resolve Pinecone index host. Set PINECONE_INDEX_HOST.")

    return pc.Index(host=host)


def _embed_texts(texts: list[str]) -> list[list[float]]:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OpenAI not configured: set OPENAI_API_KEY.")

    client = OpenAI(api_key=api_key)
    model = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")

    resp = client.embeddings.create(model=model, input=texts)
    # Keep order aligned to inputs
    return [d.embedding for d in resp.data]


def _scene_embed_text(scene: dict) -> str:
    # Stable template (don’t depend on LLM’s ingestion.embedWhat)
    open_threads = scene.get("openThreads") or []
    if isinstance(open_threads, list):
        open_threads_text = "; ".join([str(x) for x in open_threads if x])
    else:
        open_threads_text = str(open_threads)

    characters = scene.get("characters") or []
    if isinstance(characters, list):
        characters_text = ", ".join([str(x) for x in characters if x])
    else:
        characters_text = str(characters)

    parts = [
        f"Scene: {scene.get('title','')}".strip(),
        f"Setting: {scene.get('setting','')}".strip(),
        f"POV: {scene.get('pov','')}".strip(),
        f"Characters: {characters_text}".strip(),
        f"Plot: {scene.get('plotBeat','')}".strip(),
        f"Conflict: {scene.get('conflict','')}".strip(),
        f"Relationships: {scene.get('relationshipBeats','')}".strip(),
        f"Tone: {scene.get('tone','')}".strip(),
        f"Open threads: {open_threads_text}".strip(),
    ]
    return "\n".join([p for p in parts if p and not p.endswith(":")]).strip()


def upsert_scenes(result: dict, story_id: str) -> dict:
    """
    Upsert scene-level vectors to Pinecone.
    Returns a small dict with Pinecone info for logging/response (no secrets).
    """
    index = _get_pinecone_index()
    namespace = os.getenv("PINECONE_NAMESPACE", "fiction").strip() or "fiction"

    scenes = result.get("scenes") or []
    if not isinstance(scenes, list) or len(scenes) == 0:
        return {"upserted": 0, "namespace": namespace}

    vectors_payload: list[dict[str, Any]] = []
    embed_texts: list[str] = []

    story_title = result.get("storyTitle", "Untitled")
    analysis_mode = result.get("analysisMode", "")

    for scene in scenes:
        if not isinstance(scene, dict):
            continue

        scene_id = str(scene.get("id") or "")
        if not scene_id:
            continue

        embed_texts.append(_scene_embed_text(scene))

        vectors_payload.append(
            {
                "id": f"{story_id}::{scene_id}",
                "values": [],  # filled after embedding
                "metadata": {
                    "type": "scene",
                    "story_id": story_id,
                    "story_title": story_title,
                    "scene_id": scene_id,
                    "chapter": scene.get("chapter"),
                    "path_id": scene.get("pathLabel"),
                    "is_choice_point": bool(scene.get("isChoicePoint")),
                    "characters": scene.get("characters"),
                    "setting": scene.get("setting"),
                    "pov": scene.get("pov"),
                    "tone": scene.get("tone"),
                    "analysis_mode": analysis_mode,
                },
            }
        )

    embeddings = _embed_texts(embed_texts)
    for vec, emb in zip(vectors_payload, embeddings):
        vec["values"] = emb

    index.upsert(vectors=vectors_payload, namespace=namespace)
    return {"upserted": len(vectors_payload), "namespace": namespace}

