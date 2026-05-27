from services.pinecone_store import _build_retrieval_query, retrieve_similar_scenes


def retrieve_from_outline(
    *,
    premise: str = "",
    chapter_outline: str = "",
    scene_beats: str = "",
    top_k: int = 5,
    exclude_story_id: str | None = None,
) -> dict:
    query = _build_retrieval_query(premise, chapter_outline, scene_beats)
    return retrieve_similar_scenes(
        query,
        top_k=top_k,
        exclude_story_id=exclude_story_id,
    )
