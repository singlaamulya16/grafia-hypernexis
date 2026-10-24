"""Background reading of uploaded documents into the GraphRAG input folder, with live per-file progress.

Uploads are saved to myproj/uploads first. Text files are copied into the corpus straight away; PDFs are read
page by page in a background thread (text layer, or Gemini vision for scanned pages and figures). The corpus file
is written only when a document is fully read, so a half-read PDF never reaches an index build. Each finished
PDF's reading report is kept in myproj/logs/ingest_reports.json.
"""
from __future__ import annotations

import json
import logging
import shutil
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass, field
from pathlib import Path

from backend.config import GRAPH_ROOT, INPUT_DIR
from backend.pdf_extract import Cancelled, PdfReport, extract_pdf

logger = logging.getLogger(__name__)

UPLOAD_DIR = GRAPH_ROOT / "uploads"
REPORTS_FILE = GRAPH_ROOT / "logs" / "ingest_reports.json"
PARALLEL_FILES = 2


@dataclass
class ReadJob:
    """One uploaded document being read into the corpus."""

    target: str                  # corpus file name (<stem>.txt)
    original: str                # name as uploaded
    size: int
    status: str = "queued"       # queued | reading | ready | failed
    pages: int = 0
    done: int = 0
    ocr_pages: int = 0
    figure_pages: int = 0
    failed_pages: int = 0
    error: str | None = None
    started: float = field(default_factory=time.time)
    cancel: bool = False

    def public(self) -> dict:
        data = asdict(self)
        data.pop("cancel")
        return data


_JOBS: dict[str, ReadJob] = {}
_LOCK = threading.RLock()
_POOL = ThreadPoolExecutor(max_workers=PARALLEL_FILES, thread_name_prefix="read-docs")


def target_name(original: str) -> str:
    """Corpus file name for an upload: the same stem with .txt."""
    return f"{Path(original).stem}.txt"


def load_reports() -> dict[str, dict]:
    try:
        return json.loads(REPORTS_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _save_report(target: str, report: dict | None) -> None:
    with _LOCK:
        reports = load_reports()
        if report is None:
            reports.pop(target, None)
        else:
            reports[target] = report
        REPORTS_FILE.parent.mkdir(parents=True, exist_ok=True)
        REPORTS_FILE.write_text(json.dumps(reports, indent=1), encoding="utf-8")


def _write_corpus(target: str, text: str) -> None:
    """Write the corpus file atomically so a build never sees a partial document."""
    INPUT_DIR.mkdir(parents=True, exist_ok=True)
    tmp = INPUT_DIR / f".{target}.part"
    tmp.write_text(text, encoding="utf-8")
    tmp.replace(INPUT_DIR / target)


def add_text(original: str, raw: Path) -> str:
    """Copy an uploaded .txt into the corpus (instant)."""
    target = target_name(original)
    text = raw.read_bytes().decode("utf-8", errors="replace")
    _write_corpus(target, text)
    raw.unlink(missing_ok=True)
    _save_report(target, {"name": original, "kind": "txt", "chars": len(text)})
    with _LOCK:
        _JOBS.pop(target, None)
    return target


def submit_pdf(original: str, raw: Path, size: int) -> str:
    """Queue a PDF for background reading; returns its corpus file name."""
    target = target_name(original)
    job = ReadJob(target=target, original=original, size=size)
    with _LOCK:
        old = _JOBS.get(target)
        if old and old.status in ("queued", "reading"):
            old.cancel = True
        _JOBS[target] = job
    _POOL.submit(_read, job, raw)
    return target


def _read(job: ReadJob, raw: Path) -> None:
    def progress(rep: PdfReport) -> None:
        with _LOCK:
            job.status = "reading"
            job.pages, job.done = rep.pages, rep.done

    job.status = "reading"
    try:
        text, report = extract_pdf(raw, job.original, progress=progress, cancelled=lambda: job.cancel)
    except Cancelled:
        logger.info("Reading %s cancelled", job.original)
        raw.unlink(missing_ok=True)
        return
    except Exception as err:  # never let a worker die silently
        logger.exception("Reading %s crashed", job.original)
        text, report = "", PdfReport(name=job.original, error=f"{type(err).__name__}: {err}")
    with _LOCK:
        if job.cancel:
            raw.unlink(missing_ok=True)
            return
        job.pages, job.done = report.pages, report.pages
        job.ocr_pages, job.figure_pages = report.ocr_pages, report.figure_pages
        job.failed_pages = len(report.failed_pages)
        if text:
            _write_corpus(job.target, text)
            job.status = "ready"
            job.error = report.error if report.failed_pages else None
        else:
            job.status = "failed"
            job.error = report.error or "No text could be read from this file."
    raw.unlink(missing_ok=True)
    _save_report(job.target, {"kind": "pdf", **report.to_dict()} if text else None)


def jobs() -> list[dict]:
    """Documents still being read, or whose reading failed (finished ones are plain corpus files)."""
    with _LOCK:
        return [j.public() for j in _JOBS.values() if j.status != "ready"]


def busy() -> bool:
    with _LOCK:
        return any(j.status in ("queued", "reading") for j in _JOBS.values())


def forget(target: str) -> bool:
    """Cancel or drop a job and its report; True if there was one."""
    with _LOCK:
        job = _JOBS.pop(target, None)
        if job:
            job.cancel = True
    _save_report(target, None)
    return job is not None


def new_upload_path(original: str) -> Path:
    """A fresh path under myproj/uploads for streaming an upload to disk."""
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    return UPLOAD_DIR / f"{time.time_ns()}_{Path(original).name}"


def copy_stream(src, dest: Path) -> int:
    """Stream a file object to disk in chunks; returns bytes written."""
    with open(dest, "wb") as out:
        shutil.copyfileobj(src, out, length=1024 * 1024)
    return dest.stat().st_size
