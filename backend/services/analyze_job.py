"""Shared single-PDF analyze + optional Pinecone persistence."""

import os
from typing import Any, Optional

from fastapi import HTTPException

from services.analyze import analyze_fiction
from services.openai_retry import format_analysis_error
from services.pdf import extract_text_from_pdf
from services.pinecone_store import build_story_id, upsert_scenes

MAX_FILE_BYTES = 20 * 1024 * 1024  # 20 MB


def analyze_pdf_bytes(
    content: bytes,
    *,
    filename: str,
    api_key: str,
    analysis_mode: Optional[str] = "linear_choice_1",
    persist_to_pinecone: bool = False,
) -> dict[str, Any]:
    """Analyze one PDF and optionally upsert scenes to Pinecone."""
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Please upload PDF files only.")

    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"{filename}: PDF must be under 20 MB.",
        )

    if len(content) == 0:
        raise HTTPException(status_code=400, detail=f"{filename}: file is empty.")

    try:
        text = extract_text_from_pdf(content)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"{filename}: {e}") from e
    except Exception as e:
        raise HTTPException(
            status_code=422, detail=f"{filename}: failed to read PDF: {e}"
        ) from e

    try:
        result = analyze_fiction(text, api_key, analysis_mode=analysis_mode)
    except Exception as e:
        err = str(e)
        if "invalid_api_key" in err.lower() or "incorrect api key" in err.lower():
            raise HTTPException(status_code=401, detail="Invalid OpenAI API key.") from e
        if "insufficient_quota" in err.lower():
            raise HTTPException(status_code=402, detail="OpenAI quota exceeded.") from e
        raise HTTPException(status_code=502, detail=format_analysis_error(e)) from e

    if persist_to_pinecone:
        try:
            story_id = build_story_id(result.get("storyTitle", "Untitled"))
            pinecone_info = upsert_scenes(result, story_id=story_id)
            result["storyId"] = story_id
            result["pinecone"] = pinecone_info
            result["sourceFileName"] = filename
        except Exception as e:
            result["pinecone"] = {"error": str(e)}
            result["sourceFileName"] = filename

    return result
