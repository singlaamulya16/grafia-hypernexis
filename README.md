# Grafia HyperNexis

DocuDetect: upload documents, build a knowledge graph from them with GraphRAG, explore the extracted
information and ask questions answered with verified quotes.

| Folder | What it is |
|---|---|
| [`backend/`](backend) | Grafia (ThemeGraph): Python GraphRAG pipeline, graph + vector stores, and the FastAPI server (`api.py`). See [backend/README.md](backend/README.md). |
| [`frontend/`](frontend) | DocuDetect web app (TanStack Start + React): upload, Extract (map, visualise, relation diagram, resources) and Chat with the evidence graph. |

## Run locally

Backend (Python 3.13; needs a Gemini key from [AI Studio](https://aistudio.google.com/apikey)):

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env      # set GEMINI_API_KEY; GRAPH_BACKEND=kuzu works without Docker
python -m uvicorn api:app --reload --port 8000
```

Frontend (in a second terminal):

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:8080. The frontend calls the API at `http://localhost:8000` (override with `VITE_API_URL`).

Everything is built from the documents you upload: each build records the exact files it used, and after any
upload or delete the app asks you to rebuild before answering, so answers always come from the current files.
