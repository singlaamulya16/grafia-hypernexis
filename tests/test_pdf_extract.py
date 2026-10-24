"""Offline tests for reading PDFs: scanned pages go to the (fake) vision reader, with progress and a report."""
from PIL import Image, ImageDraw

from backend.pdf_extract import OCR_PROMPT, extract_pdf


def _scanned_pdf(path, pages=3):
    """An image-only PDF (no text layer), like a scan."""
    images = []
    for i in range(pages):
        im = Image.new("RGB", (600, 800), "white")
        ImageDraw.Draw(im).text((50, 50), f"Scanned page {i + 1}", fill="black")
        images.append(im)
    images[0].save(path, save_all=True, append_images=images[1:])
    return path


def test_scanned_pages_are_read_from_images_with_progress(tmp_path):
    pdf = _scanned_pdf(tmp_path / "scan.pdf")
    calls, seen = [], []

    def reader(prompt, png):
        calls.append(prompt)
        assert png.startswith(b"\x89PNG")
        return f"Text read from image {len(calls)}"

    text, report = extract_pdf(pdf, "scan.pdf", reader=reader, progress=lambda r: seen.append(r.done))
    assert report.pages == 3 and report.ocr_pages == 3 and report.text_pages == 0
    assert calls == [OCR_PROMPT] * 3 and "Text read from image" in text
    assert report.chars == len(text) and not report.failed_pages and report.error is None
    assert seen[-1] == 3


def test_failed_page_reads_are_reported(tmp_path):
    pdf = _scanned_pdf(tmp_path / "scan.pdf", pages=2)

    def reader(prompt, png):
        raise RuntimeError("quota")

    text, report = extract_pdf(pdf, reader=reader)
    assert text == "" and sorted(report.failed_pages) == [1, 2] and "quota" in report.error


def test_unreadable_file_is_reported(tmp_path):
    bad = tmp_path / "bad.pdf"
    bad.write_bytes(b"not a pdf")
    text, report = extract_pdf(bad)
    assert text == "" and "could not be opened" in report.error
