from services.pinecone_store import _build_retrieval_query, retrieve_similar_scenes

QueryFocus = str  # premise | chapter_outline | scene_beats | full


def retrieve_from_outline(
    *,
    premise: str = "",
    chapter_outline: str = "",
    scene_beats: str = "",
    top_k: int = 5,
    exclude_story_id: str | None = None,
    same_story_id: str | None = None,
    min_score: float | None = 0.4,
    query_focus: str = "full",
) -> dict:
    query = _build_retrieval_query(
        premise,
        chapter_outline,
        scene_beats,
        focus=query_focus,
    )
    return retrieve_similar_scenes(
        query,
        top_k=top_k,
        exclude_story_id=exclude_story_id,
        same_story_id=same_story_id,
        min_score=min_score,
    )
