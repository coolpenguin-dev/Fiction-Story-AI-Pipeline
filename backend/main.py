import asyncio
import os
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from typing import Any, Literal, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from services.analyze_job import analyze_pdf_bytes
from services.generate import generate_from_outline
from services.pinecone_store import check_pinecone_health, list_corpus_stories
from services.retrieve import retrieve_from_outline

load_dotenv()

app = FastAPI(
    title="Fiction RAG API",
    description="Analyzes interactive fiction PDFs and stores scene vectors for RAG-assisted writing.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_BATCH_FILES = 5
# Parallel LLM+Pinecone workers per batch (same analysis quality; tune via env if rate-limited).
BATCH_CONCURRENCY = max(1, min(5, int(os.getenv("ANALYZE_BATCH_CONCURRENCY", "3"))))

_executor = ThreadPoolExecutor(max_workers=BATCH_CONCURRENCY)


@app.get("/api/health")
def health():
    llm_configured = _llm_api_key_configured()
    pinecone = check_pinecone_health()
    ready = llm_configured and (
        not pinecone.get("configured") or pinecone.get("reachable") is True
    )
    return {
        "status": "ok" if ready else "degraded",
        "openai": {
            "configured": llm_configured,
            "note": None
            if llm_configured
            else "Set OPENAI_API_KEY in backend/.env.",
        },
        "pinecone": pinecone,
    }


def _llm_api_key_configured() -> bool:
    return bool(os.getenv("OPENAI_API_KEY", "").strip())


def _resolve_api_key() -> str:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="OpenAI API key required. Set OPENAI_API_KEY in backend/.env.",
        )
    return api_key


@app.get("/api/corpus")
def corpus():
    return list_corpus_stories()


class RetrieveRequest(BaseModel):
    premise: str = ""
    chapterOutline: str = ""
    sceneBeats: str = ""
    topK: int = Field(default=5, ge=1, le=20)
    excludeStoryId: str | None = None
    sameStoryId: str | None = None
    crossStory: bool = True
    minScore: float | None = Field(default=0.4, ge=0.0, le=1.0)
    queryFocus: Literal["premise", "chapter_outline", "scene_beats", "full"] = "full"


@app.post("/api/retrieve")
async def retrieve(body: RetrieveRequest):
    loop = asyncio.get_running_loop()
    exclude_id = None if body.sameStoryId else (body.excludeStoryId if body.crossStory else None)
    same_id = body.sameStoryId
    if not body.crossStory and body.excludeStoryId and not same_id:
        same_id = body.excludeStoryId
        exclude_id = None
    min_score = body.minScore if body.minScore > 0 else None
    return await loop.run_in_executor(
        _executor,
        lambda: retrieve_from_outline(
            premise=body.premise,
            chapter_outline=body.chapterOutline,
            scene_beats=body.sceneBeats,
            top_k=body.topK,
            exclude_story_id=exclude_id,
            same_story_id=same_id,
            min_score=min_score,
            query_focus=body.queryFocus,
        ),
    )


class RetrievedSceneInput(BaseModel):
    storyId: str = ""
    storyTitle: str = ""
    sceneId: str = ""
    score: float | None = None
    snippet: str = ""
    sourceFileName: str | None = None
    label: str | None = None


class StoryStatePatternInput(BaseModel):
    name: str = ""
    description: str = ""


class StoryStateRelationshipInput(BaseModel):
    pair: str = ""
    chapterOrScene: str = ""
    trust: str = ""
    tension: str = ""
    intimacy: str = ""
    notes: str = ""


class StoryStateInput(BaseModel):
    patterns: list[StoryStatePatternInput] = Field(default_factory=list)
    relationships: list[StoryStateRelationshipInput] = Field(default_factory=list)
    openThreads: list[str] = Field(default_factory=list)
    characters: list[str] = Field(default_factory=list)
    sceneCount: int = 0


class GenerateRequest(BaseModel):
    mode: Literal[
        "premise",
        "chapter_outline",
        "scene_beats",
        "opening_draft",
        "chapter_beats",
    ] = "premise"
    storyTitle: str = ""
    storyId: str | None = None
    premise: str = ""
    chapterOutline: str = ""
    sceneBeats: str = ""
    retrievedScenes: list[RetrievedSceneInput] = Field(default_factory=list)
    storyState: StoryStateInput | None = None
    topK: int = Field(default=5, ge=1, le=20)
    excludeStoryId: str | None = None


@app.post("/api/generate")
async def generate(body: GenerateRequest):
    api_key = _resolve_api_key()
    loop = asyncio.get_running_loop()
    scenes_payload = [s.model_dump() for s in body.retrievedScenes] or None
    state_payload = body.storyState.model_dump() if body.storyState else None
    return await loop.run_in_executor(
        _executor,
        lambda: generate_from_outline(
            mode=body.mode,  # type: ignore[arg-type]
            api_key=api_key,
            story_title=body.storyTitle,
            premise=body.premise,
            chapter_outline=body.chapterOutline,
            scene_beats=body.sceneBeats,
            retrieved_scenes=scenes_payload,
            story_state=state_payload,
            exclude_story_id=body.excludeStoryId or body.storyId,
            top_k=body.topK,
        ),
    )


@app.post("/api/analyze")
async def analyze(
    file: UploadFile = File(...),
    analysis_mode: Optional[str] = Form("linear_choice_1"),
    persist_to_pinecone: Optional[bool] = Form(False),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Please upload a PDF file.")

    content = await file.read()
    api_key = _resolve_api_key()
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        _executor,
        partial(
            analyze_pdf_bytes,
            content,
            filename=file.filename,
            api_key=api_key,
            analysis_mode=analysis_mode,
            persist_to_pinecone=bool(persist_to_pinecone),
        ),
    )


@app.post("/api/analyze-batch")
async def analyze_batch(
    files: list[UploadFile] = File(...),
    analysis_mode: Optional[str] = Form("linear_choice_1"),
    persist_to_pinecone: Optional[bool] = Form(False),
):
    if not files:
        raise HTTPException(status_code=400, detail="Upload at least one PDF.")

    if len(files) > MAX_BATCH_FILES:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {MAX_BATCH_FILES} PDFs per batch (POC limit).",
        )

    api_key = _resolve_api_key()
    persist = bool(persist_to_pinecone)

    # Read all uploads first so analysis workers are not blocked on I/O.
    payloads: list[tuple[str, bytes]] = []
    for upload in files:
        name = upload.filename or "unknown.pdf"
        payloads.append((name, await upload.read()))

    sem = asyncio.Semaphore(BATCH_CONCURRENCY)
    loop = asyncio.get_running_loop()

    async def _process_one(name: str, content: bytes) -> dict[str, Any]:
        async with sem:
            try:
                data = await loop.run_in_executor(
                    _executor,
                    partial(
                        analyze_pdf_bytes,
                        content,
                        filename=name,
                        api_key=api_key,
                        analysis_mode=analysis_mode,
                        persist_to_pinecone=persist,
                    ),
                )
                return {"fileName": name, "ok": True, "data": data}
            except HTTPException as e:
                detail = e.detail if isinstance(e.detail, str) else str(e.detail)
                return {"fileName": name, "ok": False, "error": detail}
            except Exception as e:
                return {"fileName": name, "ok": False, "error": str(e)}

    results = await asyncio.gather(
        *[_process_one(name, content) for name, content in payloads]
    )

    succeeded = sum(1 for r in results if r.get("ok"))
    failed = len(results) - succeeded

    return {
        "results": list(results),
        "summary": {
            "total": len(files),
            "succeeded": succeeded,
            "failed": failed,
        },
    }
