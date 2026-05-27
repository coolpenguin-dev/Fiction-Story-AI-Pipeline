# Fiction AI

A full-stack app for interactive fiction: upload a PDF, analyze it with OpenAI, review structured scenes and patterns, edit outlines step by step, and store scene vectors in Pinecone for scalable retrieval.

## Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS
- **Backend:** FastAPI, pypdf, OpenAI API, Pinecone

## Quick start

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env      # add your API keys
uvicorn main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The dev server proxies `/api` to the backend.

## Usage

1. Upload **1–5 text-based** fiction PDFs (max 20 MB each) — your POC corpus.
2. Enter your **OpenAI API key** (or set `OPENAI_API_KEY` in `backend/.env`).
3. Click **Analyze** — each story is analyzed and upserted to Pinecone.
4. Switch between stories in the corpus picker; browse Scenes, Patterns, Outline, Relationships, Storage.
5. **Corpus library** (top of page) shows all stories stored in Pinecone; refreshes after each analyze.

**Re-ingest:** uploading the same PDF again uses a **stable story ID** (from the filename) and **replaces** prior vectors for that story in Pinecone.

**Health:** `GET /api/health` reports OpenAI/Pinecone readiness. The status banner uses corpus vector counts when Pinecone stats are unavailable.

**Corpus:** `GET /api/corpus` lists all stories stored in Pinecone (title, story ID, scene counts). Shown in the **Corpus library** panel.

**Retrieval:** `POST /api/retrieve` — semantic search over stored scenes using your editable outline (Outline tab → **Corpus matches**).

**Generation:** `POST /api/generate` — RAG-assisted chapter beats or opening draft from your outline + corpus matches (Outline tab → **RAG-assisted generation**). Edit the output before the next step.

**API:** `POST /api/analyze` (single file) · `POST /api/analyze-batch` (multiple `files` form fields, max 5) · `POST /api/generate` · `POST /api/retrieve`.

API keys are sent to the backend for the request only and are **not stored**.

## Pinecone

Scene-level vectors are upserted automatically after each successful analysis when Pinecone is configured in `backend/.env`:

- `PINECONE_API_KEY`
- `PINECONE_INDEX_NAME` (e.g. `fiction-ai`)
- (recommended) `PINECONE_INDEX_HOST`
- `OPENAI_EMBEDDING_MODEL=text-embedding-3-small` (index must be **1536** dimensions, cosine)

## Production notes

- Set `OPENAI_API_KEY` on the server and omit the key field in the UI for clients.
- Set `VITE_API_BASE_URL` in Vercel (frontend) to your backend URL.
- Add rate limiting and auth before public deployment.
