import os
import re
import threading
from pathlib import Path
from typing import Any, Literal

from openai import OpenAI
from pinecone import Pinecone

from services.openai_retry import call_with_retry

_index_cache: Any | None = None
_index_lock = threading.Lock()
_embed_client: OpenAI | None = None
_embed_lock = threading.Lock()

PineconeStatus = Literal["ok", "partial", "skipped", "error"]


def _slugify(value: str) -> str:
    value = (value or "").strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-{2,}", "-", value).strip("-")
    return value or "story"


def pinecone_namespace() -> str:
    return os.getenv("PINECONE_NAMESPACE", "fiction").strip() or "fiction"


def pinecone_env_configured() -> bool:
    return bool(
        os.getenv("PINECONE_API_KEY", "").strip()
        and os.getenv("PINECONE_INDEX_NAME", "").strip()
    )


def build_story_id(source_filename: str, story_title: str = "Untitled") -> str:
    """
    Stable ID from upload filename so re-ingesting the same PDF replaces vectors
    instead of creating duplicates. Falls back to title slug if filename is unusable.
    """
    stem = Path(source_filename or "").stem
    slug = _slugify(stem)
    if slug in ("", "story", "untitled", "unknown"):
        slug = _slugify(story_title or "untitled")
    return slug or "story"


def _pinecone_result(
    *,
    configured: bool,
    status: PineconeStatus,
    namespace: str,
    expected: int,
    upserted: int,
    error: str | None = None,
    replaced: bool = False,
) -> dict[str, Any]:
    out: dict[str, Any] = {
        "configured": configured,
        "status": status,
        "namespace": namespace,
        "expected": expected,
        "upserted": upserted,
        "replaced": replaced,
    }
    if error:
        out["error"] = error
    return out


def check_pinecone_health() -> dict[str, Any]:
    """Non-secret Pinecone readiness for /api/health."""
    namespace = pinecone_namespace()
    index_name = os.getenv("PINECONE_INDEX_NAME", "").strip()

    if not pinecone_env_configured():
        return {
            "configured": False,
            "reachable": False,
            "namespace": namespace,
            "indexName": index_name or None,
            "error": "Set PINECONE_API_KEY and PINECONE_INDEX_NAME in backend/.env",
        }

    try:
        index = _get_pinecone_index()
        stats = index.describe_index_stats()
        ns_map = stats.get("namespaces", {}) if isinstance(stats, dict) else {}
        ns_stats = ns_map.get(namespace, {}) if isinstance(ns_map, dict) else {}
        vector_count = (
            ns_stats.get("vector_count", 0)
            if isinstance(ns_stats, dict)
            else getattr(ns_stats, "vector_count", 0)
        )
        return {
            "configured": True,
            "reachable": True,
            "namespace": namespace,
            "indexName": index_name,
            "vectorCount": int(vector_count or 0),
        }
    except Exception as e:
        return {
            "configured": True,
            "reachable": False,
            "namespace": namespace,
            "indexName": index_name,
            "error": str(e),
        }


def _get_pinecone_index() -> Any:
    global _index_cache
    if _index_cache is not None:
        return _index_cache

    with _index_lock:
        if _index_cache is not None:
            return _index_cache

        api_key = os.getenv("PINECONE_API_KEY", "").strip()
        index_name = os.getenv("PINECONE_INDEX_NAME", "").strip()
        if not api_key or not index_name:
            raise RuntimeError(
                "Pinecone not configured: set PINECONE_API_KEY and PINECONE_INDEX_NAME."
            )

        pc = Pinecone(api_key=api_key)

        host = os.getenv("PINECONE_INDEX_HOST", "").strip()
        if not host:
            desc = pc.describe_index(name=index_name)
            host = desc.get("host") if isinstance(desc, dict) else getattr(desc, "host", None)
        if not host:
            raise RuntimeError("Could not resolve Pinecone index host. Set PINECONE_INDEX_HOST.")

        _index_cache = pc.Index(host=host)
        return _index_cache


def _embedding_client() -> OpenAI:
    global _embed_client
    if _embed_client is not None:
        return _embed_client

    with _embed_lock:
        if _embed_client is not None:
            return _embed_client

        api_key = os.getenv("OPENAI_API_KEY", "").strip()
        if not api_key:
            raise RuntimeError("OpenAI not configured: set OPENAI_API_KEY.")
        timeout = float(os.getenv("OPENAI_TIMEOUT", "300"))
        _embed_client = OpenAI(api_key=api_key, timeout=timeout)
        return _embed_client


def _embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []

    client = _embedding_client()
    model = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")

    resp = call_with_retry(
        lambda: client.embeddings.create(model=model, input=texts),
        label="scene embeddings",
    )
    return [d.embedding for d in resp.data]


def _scene_embed_text(scene: dict) -> str:
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


def _delete_story_vectors(index: Any, story_id: str, namespace: str) -> None:
    """Remove prior vectors for this story before re-upsert (same filename re-ingest)."""
    try:
        index.delete(filter={"story_id": {"$eq": story_id}}, namespace=namespace)
    except Exception:
        # Best-effort; upsert still overwrites matching vector IDs.
        pass


def upsert_scenes(
    result: dict,
    story_id: str,
    *,
    source_filename: str = "",
) -> dict[str, Any]:
    """
    Upsert scene-level vectors to Pinecone.
    Re-ingesting the same source file replaces all vectors for that story_id.
    """
    if not pinecone_env_configured():
        scenes = result.get("scenes") or []
        expected = len(scenes) if isinstance(scenes, list) else 0
        return _pinecone_result(
            configured=False,
            status="skipped",
            namespace=pinecone_namespace(),
            expected=expected,
            upserted=0,
            error="Pinecone not configured: set PINECONE_API_KEY and PINECONE_INDEX_NAME.",
        )

    index = _get_pinecone_index()
    namespace = pinecone_namespace()

    scenes = result.get("scenes") or []
    if not isinstance(scenes, list):
        scenes = []

    expected = len(scenes)
    if expected == 0:
        return _pinecone_result(
            configured=True,
            status="error",
            namespace=namespace,
            expected=0,
            upserted=0,
            error="No scenes to store — analysis returned an empty scene list.",
        )

    vectors_payload: list[dict[str, Any]] = []
    embed_texts: list[str] = []
    skipped = 0

    story_title = result.get("storyTitle", "Untitled")
    analysis_mode = result.get("analysisMode", "")

    for scene in scenes:
        if not isinstance(scene, dict):
            skipped += 1
            continue

        scene_id = str(scene.get("id") or "").strip()
        if not scene_id:
            skipped += 1
            continue

        text = _scene_embed_text(scene)
        if not text:
            skipped += 1
            continue

        embed_texts.append(text)
        metadata: dict[str, Any] = {
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
        }
        if source_filename:
            metadata["source_filename"] = source_filename

        vectors_payload.append(
            {
                "id": f"{story_id}::{scene_id}",
                "values": [],
                "metadata": metadata,
            }
        )

    if not vectors_payload:
        return _pinecone_result(
            configured=True,
            status="error",
            namespace=namespace,
            expected=expected,
            upserted=0,
            error=(
                f"No embeddable scenes ({skipped} skipped). "
                "Check that analysis returned scene ids and content."
            ),
        )

    try:
        _delete_story_vectors(index, story_id, namespace)
        embeddings = _embed_texts(embed_texts)
        if len(embeddings) != len(vectors_payload):
            raise RuntimeError(
                f"Embedding count mismatch: got {len(embeddings)}, expected {len(vectors_payload)}."
            )

        for vec, emb in zip(vectors_payload, embeddings):
            vec["values"] = emb

        index.upsert(vectors=vectors_payload, namespace=namespace)
    except Exception as e:
        msg = str(e)
        if "dimension" in msg.lower():
            msg = (
                f"{msg} — index must match OPENAI_EMBEDDING_MODEL "
                "(text-embedding-3-small = 1536 dims, cosine)."
            )
        return _pinecone_result(
            configured=True,
            status="error",
            namespace=namespace,
            expected=expected,
            upserted=0,
            error=msg,
        )

    upserted = len(vectors_payload)
    status: PineconeStatus = "ok" if upserted >= expected else "partial"
    error = None
    if status == "partial":
        error = f"Stored {upserted} of {expected} scenes ({skipped} skipped during packaging)."

    return _pinecone_result(
        configured=True,
        status=status,
        namespace=namespace,
        expected=expected,
        upserted=upserted,
        error=error,
        replaced=True,
    )
