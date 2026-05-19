# Fiction RAG Trial

A full-stack demo for Michael Goode's fiction-writing trial: upload a PDF, analyze it with OpenAI, and review scene summaries, narrative patterns, an editable outline, relationship progression, and RAG ingestion recommendations.

## Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS
- **Backend:** FastAPI, pypdf, OpenAI API

## Quick start

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env      # add your OPENAI_API_KEY
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

1. Upload a **text-based** fiction PDF (max 20 MB).
2. Enter your **OpenAI API key** (or set `OPENAI_API_KEY` in `backend/.env`).
3. Click **Generate analysis**.
4. Browse tabs: Scenes, Patterns, Outline (editable), Relationships, Ingestion.

API keys are sent to the backend for the request only and are **not stored**.

## Production notes

- Set `OPENAI_API_KEY` on the server and omit the key field in the UI for clients.
- Deploy backend and frontend separately; point the frontend proxy or `VITE_API_URL` at your API.
- Add rate limiting and auth before public deployment.
