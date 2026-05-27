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


_LEGACY_STORY_ID_SUFFIX = re.compile(r"-[a-f0-9]{10}$")


def _coerce_mapping(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    to_dict = getattr(value, "to_dict", None)
    if callable(to_dict):
        result = to_dict()
        return result if isinstance(result, dict) else {}
    return {}


def _read_namespace_vector_count(ns_stats: Any) -> int:
    if ns_stats is None:
        return 0
    if isinstance(ns_stats, dict):
        raw = ns_stats.get("vector_count", ns_stats.get("vectorCount"))
    else:
        raw = getattr(ns_stats, "vector_count", None) or getattr(ns_stats, "vectorCount", None)
    try:
        return int(raw or 0)
    except (TypeError, ValueError):
        return 0


def _namespace_stats_map(stats: Any) -> dict[str, Any]:
    raw = _coerce_mapping(stats)
    namespaces = raw.get("namespaces")
    if namespaces is None:
        namespaces = getattr(stats, "namespaces", None)
    if namespaces is None:
        return {}
    return _coerce_mapping(namespaces)


def _list_page_size() -> int:
    return max(1, min(100, int(os.getenv("PINECONE_LIST_PAGE_SIZE", "100"))))


def _list_max_pages() -> int:
    return max(1, int(os.getenv("PINECONE_LIST_MAX_PAGES", "100")))


def _paginate_vector_ids(index: Any, namespace: str) -> tuple[list[str], bool]:
    """Return all vector IDs in a namespace (paginated)."""
    page_size = _list_page_size()
    max_pages = _list_max_pages()
    ids: list[str] = []
    pagination_token: str | None = None
    truncated = False

    for _ in range(max_pages):
        kwargs: dict[str, Any] = {"namespace": namespace, "limit": page_size}
        if pagination_token:
            kwargs["pagination_token"] = pagination_token

        page = index.list_paginated(**kwargs)
        items = getattr(page, "vectors", None) or []
        for item in items:
            vector_id = item if isinstance(item, str) else getattr(item, "id", None)
            if vector_id:
                ids.append(str(vector_id))

        pagination = getattr(page, "pagination", None)
        next_token = None
        if pagination is not None:
            next_token = (
                pagination.get("next")
                if isinstance(pagination, dict)
                else getattr(pagination, "next", None)
            )
        if not next_token:
            break
        pagination_token = str(next_token)
    else:
        truncated = True

    return ids, truncated


def count_namespace_vectors(index: Any, namespace: str) -> int:
    """
    Accurate vector count for a namespace.
    Falls back to listing IDs when describe_index_stats omits namespace counts
    (common on Pinecone serverless).
    """
    stats = index.describe_index_stats()
    ns_map = _namespace_stats_map(stats)
    count = _read_namespace_vector_count(ns_map.get(namespace))
    if count <= 0 and namespace:
        count = _read_namespace_vector_count(ns_map.get(""))
    if count > 0:
        return count
    ids, _ = _paginate_vector_ids(index, namespace)
    return len(ids)


def _delete_by_metadata_filter(index: Any, namespace: str, flt: dict[str, Any]) -> None:
    try:
        index.delete(filter=flt, namespace=namespace)
    except Exception:
        pass


def _is_legacy_story_id(story_id: str) -> bool:
    return bool(_LEGACY_STORY_ID_SUFFIX.search(story_id or ""))


def _pick_canonical_story_id(entries: list[dict[str, Any]]) -> str:
    """Choose the story_id to keep when multiple groups share a title."""

    def score(entry: dict[str, Any]) -> tuple[int, int, str]:
        story_id = str(entry.get("storyId") or "")
        source = str(entry.get("sourceFileName") or "")
        title = str(entry.get("storyTitle") or "")
        points = entry.get("sceneCount", 0) or 0
        if source:
            points += 1000
            if story_id == build_story_id(source, title):
                points += 500
        title_slug = _slugify(title)
        if title_slug and story_id == title_slug:
            points += 300
        if not _is_legacy_story_id(story_id):
            points += 100
        return (points, entry.get("sceneCount", 0) or 0, story_id)

    return max(entries, key=score)["storyId"]


def deduplicate_corpus_stories() -> dict[str, int]:
    """
    Remove duplicate story_id groups that share the same story_title (legacy uploads).
    Keeps the best canonical id per title (stable slug + source file preferred).
    """
    if not pinecone_env_configured():
        return {"removedStoryGroups": 0, "removedVectors": 0}

    index = _get_pinecone_index()
    namespace = pinecone_namespace()
    vector_ids, _ = _paginate_vector_ids(index, namespace)
    if not vector_ids:
        return {"removedStoryGroups": 0, "removedVectors": 0}

    grouped: dict[str, dict[str, Any]] = {}
    for vector_id in vector_ids:
        story_id, _ = _parse_vector_story_key(vector_id)
        if story_id not in grouped:
            grouped[story_id] = {
                "storyId": story_id,
                "sceneCount": 0,
                "sampleVectorId": vector_id,
            }
        grouped[story_id]["sceneCount"] += 1

    summaries: list[dict[str, Any]] = []
    if grouped:
        sample_ids = [info["sampleVectorId"] for info in grouped.values()]
        try:
            fetched = index.fetch(ids=sample_ids, namespace=namespace)
            vectors_map = getattr(fetched, "vectors", None) or {}
        except Exception:
            vectors_map = {}

        for story_id, info in grouped.items():
            raw_vec = vectors_map.get(info["sampleVectorId"]) if isinstance(vectors_map, dict) else None
            meta = _vector_metadata(raw_vec)
            summaries.append(
                {
                    "storyId": story_id,
                    "storyTitle": str(meta.get("story_title") or story_id.replace("-", " ").title()),
                    "sourceFileName": str(meta.get("source_filename") or "") or None,
                    "sceneCount": info["sceneCount"],
                }
            )

    by_title: dict[str, list[dict[str, Any]]] = {}
    for entry in summaries:
        key = (entry.get("storyTitle") or entry["storyId"]).strip().lower()
        by_title.setdefault(key, []).append(entry)

    removed_groups = 0
    removed_vectors = 0
    for entries in by_title.values():
        if len(entries) <= 1:
            continue
        canonical = _pick_canonical_story_id(entries)
        for entry in entries:
            if entry["storyId"] == canonical:
                continue
            _delete_by_metadata_filter(
                index,
                namespace,
                {"story_id": {"$eq": entry["storyId"]}},
            )
            removed_groups += 1
            removed_vectors += int(entry.get("sceneCount") or 0)

    return {"removedStoryGroups": removed_groups, "removedVectors": removed_vectors}


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
        vector_count = count_namespace_vectors(index, namespace)
        return {
            "configured": True,
            "reachable": True,
            "namespace": namespace,
            "indexName": index_name,
            "vectorCount": vector_count,
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


def _clear_story_before_upsert(
    index: Any,
    namespace: str,
    *,
    story_id: str,
    source_filename: str = "",
    story_title: str = "",
) -> None:
    """Remove prior vectors for this manuscript (stable id, file, or title)."""
    _delete_by_metadata_filter(index, namespace, {"story_id": {"$eq": story_id}})
    if source_filename:
        _delete_by_metadata_filter(
            index, namespace, {"source_filename": {"$eq": source_filename}}
        )
    title = (story_title or "").strip()
    if title and title != "Untitled":
        _delete_by_metadata_filter(index, namespace, {"story_title": {"$eq": title}})


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
        _clear_story_before_upsert(
            index,
            namespace,
            story_id=story_id,
            source_filename=source_filename,
            story_title=story_title,
        )
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


def _parse_vector_story_key(vector_id: str) -> tuple[str, str | None]:
    """Return (story_id, scene_id) from vector id ``{story_id}::{scene_id}``."""
    if "::" in vector_id:
        story_id, scene_id = vector_id.split("::", 1)
        return story_id, scene_id or None
    return vector_id, None


def _vector_metadata(raw_vec: Any) -> dict[str, Any]:
    if raw_vec is None:
        return {}
    if isinstance(raw_vec, dict):
        meta = raw_vec.get("metadata")
        return meta if isinstance(meta, dict) else {}
    meta = getattr(raw_vec, "metadata", None)
    return meta if isinstance(meta, dict) else {}


def list_corpus_stories(*, dedupe: bool = True) -> dict[str, Any]:
    """
    List stories stored in Pinecone by aggregating scene vectors in the active namespace.
    """
    namespace = pinecone_namespace()
    dedupe_stats = {"removedStoryGroups": 0, "removedVectors": 0}
    if dedupe:
        dedupe_stats = deduplicate_corpus_stories()

    if not pinecone_env_configured():
        return {
            "configured": False,
            "namespace": namespace,
            "stories": [],
            "summary": {"storyCount": 0, "totalScenes": 0, "totalVectors": 0},
            "dedupe": dedupe_stats,
            "error": "Pinecone not configured: set PINECONE_API_KEY and PINECONE_INDEX_NAME.",
        }

    page_size = _list_page_size()
    max_pages = _list_max_pages()

    try:
        index = _get_pinecone_index()
    except Exception as e:
        return {
            "configured": True,
            "namespace": namespace,
            "stories": [],
            "summary": {"storyCount": 0, "totalScenes": 0, "totalVectors": 0},
            "dedupe": dedupe_stats,
            "error": str(e),
        }

    grouped: dict[str, dict[str, Any]] = {}
    truncated = False

    try:
        vector_ids, truncated = _paginate_vector_ids(index, namespace)
    except Exception as e:
        return {
            "configured": True,
            "namespace": namespace,
            "stories": [],
            "summary": {"storyCount": 0, "totalScenes": 0, "totalVectors": 0},
            "dedupe": dedupe_stats,
            "error": f"Failed to list vectors: {e}",
        }

    total_vectors = len(vector_ids)
    for vector_id in vector_ids:
        story_id, _scene_id = _parse_vector_story_key(vector_id)
        if story_id not in grouped:
            grouped[story_id] = {
                "storyId": story_id,
                "sceneCount": 0,
                "sampleVectorId": vector_id,
            }
        grouped[story_id]["sceneCount"] += 1

    stories: list[dict[str, Any]] = []
    if grouped:
        sample_ids = [info["sampleVectorId"] for info in grouped.values()]
        try:
            fetched = index.fetch(ids=sample_ids, namespace=namespace)
            vectors_map = getattr(fetched, "vectors", None) or {}
        except Exception:
            vectors_map = {}

        for story_id, info in grouped.items():
            sample_id = info["sampleVectorId"]
            raw_vec = vectors_map.get(sample_id) if isinstance(vectors_map, dict) else None
            meta = _vector_metadata(raw_vec)

            title = str(meta.get("story_title") or story_id.replace("-", " ").title())
            source = str(meta.get("source_filename") or "")
            analysis_mode = str(meta.get("analysis_mode") or "")

            stories.append(
                {
                    "storyId": story_id,
                    "storyTitle": title,
                    "sourceFileName": source or None,
                    "sceneCount": info["sceneCount"],
                    "analysisMode": analysis_mode or None,
                }
            )

    stories.sort(key=lambda s: (s.get("storyTitle") or s["storyId"]).lower())
    total_scenes = sum(s["sceneCount"] for s in stories)

    out: dict[str, Any] = {
        "configured": True,
        "namespace": namespace,
        "stories": stories,
        "summary": {
            "storyCount": len(stories),
            "totalScenes": total_scenes,
            "totalVectors": total_vectors,
        },
        "dedupe": dedupe_stats,
    }
    if truncated:
        out["truncated"] = True
        out["warning"] = (
            f"Corpus list capped at {max_pages * page_size} vectors. "
            "Increase PINECONE_LIST_MAX_PAGES if needed."
        )
    return out
