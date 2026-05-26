import os
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from services.analyze import analyze_fiction
from services.pdf import extract_text_from_pdf
from services.pinecone_store import build_story_id, upsert_scenes

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

MAX_FILE_BYTES = 20 * 1024 * 1024  # 20 MB


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/analyze")
async def analyze(
    file: UploadFile = File(...),
    openai_api_key: Optional[str] = Form(None),
    analysis_mode: Optional[str] = Form("linear_choice_1"),
    persist_to_pinecone: Optional[bool] = Form(False),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Please upload a PDF file.")

    content = await file.read()
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(status_code=400, detail="PDF must be under 20 MB.")

    if len(content) == 0:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    api_key = (openai_api_key or "").strip() or os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="OpenAI API key required. Enter your key in the app or set OPENAI_API_KEY on the server.",
        )

    try:
        text = extract_text_from_pdf(content)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to read PDF: {e}") from e

    try:
        result = analyze_fiction(text, api_key, analysis_mode=analysis_mode)
    except Exception as e:
        err = str(e)
        if "invalid_api_key" in err.lower() or "incorrect api key" in err.lower():
            raise HTTPException(status_code=401, detail="Invalid OpenAI API key.") from e
        if "insufficient_quota" in err.lower():
            raise HTTPException(status_code=402, detail="OpenAI quota exceeded.") from e
        raise HTTPException(status_code=502, detail=f"Analysis failed: {err}") from e

    # Optionally persist to Pinecone for scalable RAG
    if persist_to_pinecone:
        try:
            story_id = build_story_id(result.get("storyTitle", "Untitled"))
            pinecone_info = upsert_scenes(result, story_id=story_id)
            result["storyId"] = story_id
            result["pinecone"] = pinecone_info
        except Exception as e:
            # Don't fail analysis response if persistence fails
            result["pinecone"] = {"error": str(e)}

    return result
