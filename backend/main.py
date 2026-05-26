import asyncio
import os
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from typing import Any, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from services.analyze_job import analyze_pdf_bytes

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
    return {"status": "ok"}


def _resolve_api_key(openai_api_key: Optional[str]) -> str:
    api_key = (openai_api_key or "").strip() or os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="OpenAI API key required. Enter your key in the app or set OPENAI_API_KEY on the server.",
        )
    return api_key


@app.post("/api/analyze")
async def analyze(
    file: UploadFile = File(...),
    openai_api_key: Optional[str] = Form(None),
    analysis_mode: Optional[str] = Form("linear_choice_1"),
    persist_to_pinecone: Optional[bool] = Form(False),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Please upload a PDF file.")

    content = await file.read()
    api_key = _resolve_api_key(openai_api_key)
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
    openai_api_key: Optional[str] = Form(None),
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

    api_key = _resolve_api_key(openai_api_key)
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
