"""HTTP API for web frontends: upload documents, build the index, ask questions.

Run with `uvicorn api:app --reload --port 8000`. Everything is served from the real GraphRAG index built from the
uploaded documents. Each build records which files it was built from; when the corpus changes afterwards the index
is reported as stale and questions are refused until it is rebuilt, so answers never come from old documents.
"""
from __future__ import annotations

import json
import logging
import os
import tempfile
import time
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from backend import index_job
from backend.config import GEMINI_API_KEY, INPUT_DIR, OUTPUT_DIR
from backend.contracts import Response

logger = logging.getLogger(__name__)

Mode = Literal["auto", "global", "local", "hybrid", "basic", "graphrag_local", "graphrag_global"]

app = FastAPI(title="ThemeGraph API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_methods=["*"],
    allow_headers=["*"],
)

PENDING_FILE = index_job.LOG_DIR / "corpus_pending.json"
BUILT_FILE = index_job.LOG_DIR / "corpus_built.json"
_REFRESHED_RUN: float | None = None


def index_ready() -> bool:
    """GraphRAG output parquet files exist."""
    return (OUTPUT_DIR / "entities.parquet").exists() and (OUTPUT_DIR / "relationships.parquet").exists()


def corpus_signature() -> list[list]:
    """(name, size, mtime) of every corpus file; changes whenever a file is added, replaced or deleted."""
    return [[p.name, p.stat().st_size, round(p.stat().st_mtime, 3)] for p in index_job.input_files()]


def _read_json(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def built_signature() -> list[list] | None:
    """Corpus signature of the index currently in OUTPUT_DIR, or None if unknown."""
    data = _read_json(BUILT_FILE)
    return data.get("signature") if data else None


def built_files() -> list[str]:
    """Corpus files that are in the built index unchanged (same name, size and mtime)."""
    if not index_ready():
        return []
    built = {tuple(entry) for entry in built_signature() or []}
    return [entry[0] for entry in corpus_signature() if tuple(entry) in built]


def index_fresh() -> bool:
    """The built index was made from exactly the documents in the corpus now."""
    return index_ready() and bool(index_job.input_files()) and built_signature() == corpus_signature()


def _sync_index() -> index_job.JobStatus:
    """Read the job status; after a new successful build, mark its corpus as built and drop every cache once."""
    global _REFRESHED_RUN
    job = index_job.status()
    if job.state == "success" and job.started != _REFRESHED_RUN:
        _REFRESHED_RUN = job.started
        pending = _read_json(PENDING_FILE)
        if pending and job.started and pending.get("requested", 0) <= job.started + 5:
            BUILT_FILE.write_text(json.dumps({"signature": pending["signature"], "built": time.time()}), encoding="utf-8")
            PENDING_FILE.unlink(missing_ok=True)
        from backend import pipeline

        pipeline.reset_graph()
        logger.info("Index rebuilt; caches cleared so retrieval uses the new documents")
    return job


def _not_ready_reason(job: index_job.JobStatus) -> str | None:
    """Why questions cannot be answered from the current documents, or None if they can."""
    if not index_job.input_files():
        return "Upload documents first."
    if job.state == "running":
        return "The knowledge graph is being built; try again when it finishes."
    if not index_ready():
        return "Build the knowledge graph from your documents first."
    if not index_fresh():
        return "Your documents changed since the last build. Rebuild the knowledge graph first."
    return None


# ---------- models ----------

class Document(BaseModel):
    name: str
    size: int
    modified: float | None = None


class UploadResult(BaseModel):
    accepted: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    estimate: dict[str, int] = Field(default_factory=dict)


class IndexStatus(BaseModel):
    state: Literal["idle", "running", "success", "failed", "cancelled"]
    stages: list[str]
    done: list[str] = Field(default_factory=list)
    current: str | None = None
    elapsed_s: float = 0.0
    tail: list[str] = Field(default_factory=list)
    error: str | None = None
    started: float | None = None
    fresh: bool = False
    built_files: list[str] = Field(default_factory=list)


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    mode: Mode = "auto"
    support_check: bool = True


# ---------- endpoints ----------

@app.get("/api/health")
def health() -> dict:
    job = _sync_index()
    return {"ok": True, "api_key": bool(GEMINI_API_KEY), "index_ready": index_ready(), "fresh": index_fresh(),
            "documents": len(index_job.input_files()), "reason": _not_ready_reason(job)}


@app.get("/api/documents")
def list_documents() -> list[Document]:
    return [Document(name=p.name, size=p.stat().st_size, modified=p.stat().st_mtime) for p in index_job.input_files()]


@app.post("/api/documents")
async def upload_documents(files: list[UploadFile] = File(...)) -> UploadResult:
    """Validate uploads (.txt/.pdf, size, count) and add accepted ones to the corpus."""
    if index_job.running():
        raise HTTPException(409, "An index build is running; upload after it finishes.")
    batch = [(f.filename or "upload", await f.read()) for f in files]
    report = index_job.validate_uploads(batch, existing=len(index_job.input_files()))
    if report.errors:
        return UploadResult(errors=[*report.errors, "No files were added; fix the problems above and upload again."],
                            warnings=report.warnings)
    if report.accepted:
        from backend.engine import ingest_files

        with tempfile.TemporaryDirectory() as tmp:
            paths = []
            for name, data in report.accepted:
                p = Path(tmp) / Path(name).name
                p.write_bytes(data)
                paths.append(p)
            ingest_files(paths)
    return UploadResult(accepted=[n for n, _ in report.accepted], warnings=report.warnings,
                        estimate=index_job.estimate([p.stat().st_size for p in index_job.input_files()]))


@app.delete("/api/documents/{name}")
def delete_document(name: str) -> dict:
    if index_job.running():
        raise HTTPException(409, "An index build is running; delete after it finishes.")
    target = (INPUT_DIR / name).resolve()
    if target.parent != INPUT_DIR.resolve() or not target.is_file():
        raise HTTPException(404, f"{name} is not in the corpus.")
    target.unlink()
    logger.info("Deleted corpus file %s", target)
    return {"deleted": name}


def _status() -> IndexStatus:
    job = _sync_index()
    return IndexStatus(state=job.state, stages=[s for s, _ in index_job.STAGES], done=job.done, current=job.current,
                       elapsed_s=round(job.elapsed_s, 1), tail=job.tail, error=job.error, started=job.started,
                       fresh=index_fresh(), built_files=built_files())


@app.get("/api/index")
def index_status() -> IndexStatus:
    return _status()


@app.post("/api/index")
def start_index() -> IndexStatus:
    """Start a background GraphRAG build of every document in the corpus."""
    if not index_job.input_files():
        raise HTTPException(400, "Upload at least one document first.")
    if not GEMINI_API_KEY:
        raise HTTPException(400, "GEMINI_API_KEY is not set in Grafia/.env, so the documents cannot be processed.")
    index_job.LOG_DIR.mkdir(parents=True, exist_ok=True)
    PENDING_FILE.write_text(json.dumps({"signature": corpus_signature(), "requested": time.time()}), encoding="utf-8")
    try:
        index_job.start()
    except index_job.IndexLocked as err:
        raise HTTPException(409, str(err)) from err
    time.sleep(0.2)
    return _status()


@app.post("/api/index/cancel")
def cancel_index() -> IndexStatus:
    index_job.cancel()
    return _status()


class Entity(BaseModel):
    name: str
    type: str
    description: str = ""
    degree: int = 0
    community: str = ""


class Relationship(BaseModel):
    source: str
    target: str
    description: str = ""
    weight: float = 1.0


class Community(BaseModel):
    id: str
    title: str
    summary: str = ""
    size: int = 0
    rank: float = 0.0


class Insights(BaseModel):
    ready: bool
    reason: str | None = None
    stats: dict[str, int] = Field(default_factory=dict)
    type_counts: dict[str, int] = Field(default_factory=dict)
    entities: list[Entity] = Field(default_factory=list)
    relationships: list[Relationship] = Field(default_factory=list)
    communities: list[Community] = Field(default_factory=list)


MAX_ENTITIES = 400
MAX_RELATIONSHIPS = 800


def _graph_and_reports() -> tuple:
    """(graph, community report dicts, document count) from the built index."""
    from backend import pipeline
    from backend.engine import load_tables

    tables = load_tables()
    reports = []
    df = tables.get("community_reports")
    if df is not None:
        for r in df.to_dict("records"):
            reports.append({"community": str(r.get("community")), "title": str(r.get("title") or ""),
                            "summary": str(r.get("summary") or ""), "size": int(r.get("size") or 0),
                            "rank": float(r.get("rank") or 0), "level": int(r.get("level") or 0)})
    docs = tables.get("documents")
    return pipeline.get_graph(), reports, 0 if docs is None else len(docs)


@app.get("/api/insights")
def insights() -> Insights:
    """Entities, relationships and themes of the knowledge graph, for summaries, charts and the relation diagram."""
    reason = _not_ready_reason(_sync_index())
    if reason:
        return Insights(ready=False, reason=reason)
    graph, reports, n_docs = _graph_and_reports()
    nodes = sorted(graph.nodes(data=True), key=lambda nd: nd[1].get("degree", 0), reverse=True)[:MAX_ENTITIES]
    keep = {n for n, _ in nodes}
    type_counts: dict[str, int] = {}
    for _, d in graph.nodes(data=True):
        t = str(d.get("type") or "unknown").lower()
        type_counts[t] = type_counts.get(t, 0) + 1
    edges = sorted(((s, t, d) for s, t, d in graph.edges(data=True) if s in keep and t in keep),
                   key=lambda e: e[2].get("weight", 1.0), reverse=True)[:MAX_RELATIONSHIPS]
    top_level = [r for r in reports if r.get("level", 0) == 0] or reports
    communities = sorted((Community(id=str(r["community"]), title=r["title"], summary=r.get("summary", ""),
                                    size=int(r.get("size") or 0), rank=float(r.get("rank") or 0)) for r in top_level),
                         key=lambda c: c.rank, reverse=True)
    return Insights(
        ready=True,
        stats={"docs": n_docs, "entities": graph.number_of_nodes(), "relationships": graph.number_of_edges(),
               "communities": len(communities)},
        type_counts=dict(sorted(type_counts.items(), key=lambda kv: kv[1], reverse=True)),
        entities=[Entity(name=n, type=str(d.get("type") or "unknown").lower(), description=str(d.get("description") or ""),
                         degree=int(d.get("degree", 0)), community=str(d.get("community", ""))) for n, d in nodes],
        relationships=[Relationship(source=s, target=t, description=str(d.get("description") or ""),
                                    weight=float(d.get("weight", 1.0))) for s, t, d in edges],
        communities=communities,
    )


@app.post("/api/ask")
async def ask(req: AskRequest) -> Response:
    """Answer a question from the current documents; refuses (409) while the index is missing or out of date."""
    reason = _not_ready_reason(_sync_index())
    if reason:
        raise HTTPException(409, reason)
    from backend import pipeline

    return await run_in_threadpool(pipeline.run, req.question, req.mode, req.support_check)
