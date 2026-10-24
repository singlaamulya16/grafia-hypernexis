"""Read a PDF into text: the text layer where there is one, Gemini vision for scanned pages and figures.

Pages whose text layer is empty (scans, photographed pages) are rendered to images and transcribed; pages that
have text and also a large picture, chart or diagram get a short factual description of the figure appended, so
image content reaches the knowledge graph too. Pages are streamed from disk one at a time (files up to 100 MB),
image reads run in parallel, and a progress callback reports every finished page.
"""
from __future__ import annotations

import io
import logging
import threading
from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Callable

logger = logging.getLogger(__name__)

MIN_TEXT_CHARS = 25          # a page with less text than this is treated as an image
FIGURE_AREA_SHARE = 0.15     # describe figures covering at least this share of a text page
RENDER_SCALE = 2.0           # ~144 dpi: legible for OCR, small enough to upload quickly
MAX_WORKERS = 4              # parallel Gemini image reads per file
MAX_IN_FLIGHT = 8            # rendered pages waiting for a reader (bounds memory on long scans)

OCR_PROMPT = (
    "This is one page of a document. Transcribe every piece of text on it exactly, in reading order, keeping "
    "headings, lists and table rows on their own lines. Then, for each photo, chart, diagram, map or other figure "
    "on the page, add a line starting 'Figure:' with a short factual description including any labels, numbers "
    "or names it shows. Do not add commentary. If the page is blank, reply with BLANK."
)
FIGURE_PROMPT = (
    "This is one page of a document. Its text is already known. Describe only the photos, charts, diagrams, maps "
    "or other figures on it: one line per figure starting 'Figure:', with a short factual description including "
    "any labels, numbers or names it shows. If there are no figures, reply with NONE."
)

Reader = Callable[[str, bytes], str]


class Cancelled(Exception):
    """Reading was cancelled (the file was deleted while being read)."""


@dataclass
class PdfReport:
    """How one PDF was read."""

    name: str
    pages: int = 0
    done: int = 0
    text_pages: int = 0
    ocr_pages: int = 0
    figure_pages: int = 0
    failed_pages: list[int] = field(default_factory=list)
    chars: int = 0
    error: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


def _gemini_reader(prompt: str, png: bytes) -> str:
    from backend import llm
    from backend.config import LLM_MODEL_STRONG

    return llm.vision_text(LLM_MODEL_STRONG, prompt, png)


def _render(pdf, index: int) -> bytes:
    """Render one page (pypdfium2 document) to PNG bytes."""
    page = pdf[index]
    try:
        image = page.render(scale=RENDER_SCALE).to_pil()
    finally:
        page.close()
    buf = io.BytesIO()
    image.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def extract_pdf(path: str | Path, name: str | None = None, reader: Reader | None = None,
                progress: Callable[[PdfReport], None] | None = None,
                cancelled: Callable[[], bool] | None = None) -> tuple[str, PdfReport]:
    """Return (document text, report). Raises Cancelled; any other failure comes back as report.error."""
    import pdfplumber
    import pypdfium2

    path = Path(path)
    reader = reader or _gemini_reader
    report = PdfReport(name=name or path.name)
    lock = threading.Lock()
    slots = threading.BoundedSemaphore(MAX_IN_FLIGHT)

    def tick() -> None:
        with lock:
            report.done += 1
        if progress:
            progress(report)

    try:
        plumber = pdfplumber.open(path)
        pdf = pypdfium2.PdfDocument(str(path))
    except Exception as err:
        report.error = f"could not be opened as a PDF ({type(err).__name__})"
        return "", report

    texts: list[str] = []
    jobs: dict[int, tuple[str, Future]] = {}

    def read(i: int, prompt: str, png: bytes) -> str | None:
        try:
            if cancelled and cancelled():
                return None
            return reader(prompt, png).strip()
        except Exception as err:
            logger.warning("Reading page %d of %s from its image failed: %s", i + 1, report.name, err)
            with lock:
                if report.error is None:
                    report.error = f"{type(err).__name__}: {err}"[:300]
            return None

    pool = ThreadPoolExecutor(max_workers=MAX_WORKERS)
    try:
        report.pages = len(plumber.pages)
        if progress:
            progress(report)
        for i, page in enumerate(plumber.pages):
            if cancelled and cancelled():
                raise Cancelled(report.name)
            text = (page.extract_text() or "").strip()
            prompt = None
            if len(text) < MIN_TEXT_CHARS:
                prompt = OCR_PROMPT
            else:
                report.text_pages += 1
                area = float(page.width * page.height) or 1.0
                figures = sum(float(im.get("width", 0)) * float(im.get("height", 0)) for im in page.images)
                if figures / area >= FIGURE_AREA_SHARE:
                    prompt = FIGURE_PROMPT
            texts.append(text)
            if prompt:
                png = _render(pdf, i)
                slots.acquire()
                fut = pool.submit(read, i, prompt, png)
                fut.add_done_callback(lambda _f: (slots.release(), tick()))
                jobs[i] = (prompt, fut)
            else:
                tick()
            if hasattr(page, "close"):
                page.close()  # frees pdfplumber's per-page cache on long documents
    finally:
        pool.shutdown(wait=True)
        plumber.close()
        pdf.close()
    if cancelled and cancelled():
        raise Cancelled(report.name)

    parts: list[str] = []
    for i, text in enumerate(texts):
        if i in jobs:
            prompt, fut = jobs[i]
            got = fut.result()
            if got is None:
                report.failed_pages.append(i + 1)
            elif prompt is OCR_PROMPT:
                if got.upper() != "BLANK":
                    text = got
                report.ocr_pages += 1
            elif got.upper() != "NONE":
                text = f"{text}\n{got}"
                report.figure_pages += 1
        if text:
            parts.append(text)
    document = "\n\n".join(parts).strip()
    report.chars = len(document)
    if document and not report.failed_pages:
        report.error = None
    logger.info("Read %s: %s", report.name, {k: v for k, v in report.to_dict().items() if k != "failed_pages"})
    return document, report
