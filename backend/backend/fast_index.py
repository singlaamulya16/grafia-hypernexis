"""Fast knowledge-graph build: a few large Gemini calls instead of GraphRAG's hundreds of small ones.

GraphRAG's standard pipeline makes one LLM call per chunk (plus gleanings), one per entity description summary
and one per community report, which on a free-tier key (15 requests/minute) takes many minutes. This builder
sends the whole corpus to Gemini in a few large batches (the model reads ~1M tokens) to extract entities and
relationships as JSON, finds communities locally with Louvain clustering, writes every community report in one
more call, and stores the result in the same parquet tables GraphRAG produces, so retrieval, the graph view and
the stores work unchanged. Progress is written to the index log with GraphRAG's workflow names.
"""
from __future__ import annotations

import hashlib
import json
import logging
import re
import shutil
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Callable

import networkx as nx
import pandas as pd

from backend.config import GRAPH_ROOT, INPUT_DIR, LLM_MODEL_STRONG

logger = logging.getLogger(__name__)

STAGING_DIR = GRAPH_ROOT / "output_staging"
CHUNK_CHARS = 2400          # ~600 tokens per text unit (what citations and retrieval work with)
MAX_BATCHES = 12            # extraction calls per build: all run in parallel and stay under the free tier's
                            # 15 requests/minute (one more call writes the community reports)
REASONING = "minimal"       # Gemini thinking budget for build calls: about half the latency of the default
ENTITY_TYPES = ["organization", "person", "location", "project", "technology", "policy", "event"]

EXTRACT_SYSTEM = (
    "You build a knowledge graph from documents. Extract the important entities and the relationships between "
    "them. Use only facts stated in the text. Entity types: " + ", ".join(ENTITY_TYPES) + ". Names are the "
    "fullest form used in the text. Descriptions are one short factual sentence (at most 20 words). Every "
    "entity and relationship lists the ids of the chunks that support it. Use the compact array format."
)
# Arrays instead of objects: output tokens are what make extraction slow, and keys repeat on every item.
EXTRACT_SCHEMA = (
    '{"e": [[name, type, description, [chunk ids]]], '
    '"r": [[source name, target name, description, strength 1-10, [chunk ids]]]}'
)
REPORT_SYSTEM = (
    "You summarise themes in a knowledge graph. For each community of related entities, write a short title "
    "naming the theme and a 2-4 sentence factual summary of what the documents say about it, using only the "
    "entities and relationships given. Rate the theme's importance from 0 to 10."
)
REPORT_SCHEMA = '{"reports": [{"community": int, "title": str, "summary": str, "rating": number}]}'

COMMUNITY_COLUMNS = ["id", "human_readable_id", "community", "level", "parent", "children", "title", "entity_ids",
                     "relationship_ids", "text_unit_ids", "period", "size"]
REPORT_COLUMNS = ["id", "human_readable_id", "community", "level", "parent", "children", "title", "summary",
                  "full_content", "rank", "rating_explanation", "findings", "full_content_json", "period", "size"]

Log = Callable[[str], None]


def _id(*parts: str) -> str:
    return hashlib.sha1("\x00".join(parts).encode("utf-8")).hexdigest()


def _chunks(text: str) -> list[str]:
    """Split text into ~CHUNK_CHARS pieces on paragraph or sentence boundaries."""
    text = text.strip()
    if len(text) <= CHUNK_CHARS:
        return [text] if text else []
    parts, start = [], 0
    while start < len(text):
        end = min(len(text), start + CHUNK_CHARS)
        if end < len(text):
            window = text[start:end]
            cut = max(window.rfind("\n\n"), window.rfind(". "), window.rfind("\n"))
            if cut > CHUNK_CHARS // 2:
                end = start + cut + 1
        piece = text[start:end].strip()
        if piece:
            parts.append(piece)
        start = end
    return parts


def _documents() -> tuple[pd.DataFrame, pd.DataFrame]:
    """documents and text_units tables from the corpus folder."""
    docs, units = [], []
    for path in sorted(INPUT_DIR.glob("*.txt")):
        text = path.read_text(encoding="utf-8", errors="replace")
        doc_id = _id("doc", path.name)
        unit_ids = []
        for k, piece in enumerate(_chunks(text)):
            uid = _id("unit", path.name, str(k))
            unit_ids.append(uid)
            units.append({"id": uid, "human_readable_id": len(units), "text": piece,
                          "n_tokens": len(piece) // 4, "document_id": doc_id})
        docs.append({"id": doc_id, "human_readable_id": len(docs), "title": path.name, "text": text,
                     "text_unit_ids": unit_ids, "creation_date": time.strftime("%Y-%m-%d %H:%M:%S"),
                     "raw_data": None})
    return pd.DataFrame(docs), pd.DataFrame(units)


def _batches(units: pd.DataFrame) -> list[list[dict]]:
    """Split chunks (in order) into at most MAX_BATCHES similar-sized batches: small corpora get about one chunk
    per call (fastest, since output length sets latency), large ones get fewer, bigger batches."""
    records = units.to_dict("records")
    total = sum(len(r["text"]) for r in records)
    limit = max(1, -(-total // min(MAX_BATCHES, len(records))))
    batches, current, size = [], [], 0
    for r in records:
        if current and size + len(r["text"]) > limit and len(batches) < MAX_BATCHES - 1:
            batches.append(current)
            current, size = [], 0
        current.append(r)
        size += len(r["text"])
    if current:
        batches.append(current)
    return batches


def _extract(batch: list[dict], short: dict[str, str]) -> dict:
    from backend import llm

    body = "\n\n".join(f"[chunk {short[r['id']]}]\n{r['text']}" for r in batch)
    return llm.chat_json(LLM_MODEL_STRONG, EXTRACT_SYSTEM, body, EXTRACT_SCHEMA, reasoning_effort=REASONING)


def _items(res: dict, short: str, long: str, fields: tuple[str, ...]) -> list[dict]:
    """Rows from the compact array format (or the object format, if the model used it) as dicts."""
    out = []
    for row in res.get(short) or res.get(long) or []:
        if isinstance(row, dict):
            out.append(row)
        elif isinstance(row, (list, tuple)):
            item = dict(zip(fields, row))
            chunks = item.get("chunks")
            if chunks is not None and not isinstance(chunks, (list, tuple)):
                item["chunks"] = [chunks]
            out.append(item)
    return out


def _norm(name: str) -> str:
    return re.sub(r"\s+", " ", str(name)).strip().upper()


def build(log: Log, cancelled: Callable[[], bool] = lambda: False) -> bool:
    """Build the index into output_staging and promote it; returns True on success."""
    from backend import llm
    from backend.engine import _promote

    t0 = time.perf_counter()
    log("Workflow create_base_text_units started")
    docs, units = _documents()
    if units.empty:
        log("ERROR No input documents with text were found.")
        return False
    log(f"Workflow create_base_text_units finished ({len(docs)} documents, {len(units)} chunks)")
    from backend.stores.vector_store import prewarm

    # Embeddings for the store load are computed in the background while Gemini writes the community reports
    # (a network wait). Not during extraction: local embedding uses every CPU core and slows the API calls down.
    background = ThreadPoolExecutor(max_workers=1, thread_name_prefix="prewarm")

    # ---- entities and relationships: a few large calls in parallel ----
    log("Workflow extract_graph started")
    short = {uid: str(i + 1) for i, uid in enumerate(units["id"])}
    by_short = {v: k for k, v in short.items()}
    batches = _batches(units)
    done = 0
    results: list[dict] = []
    with ThreadPoolExecutor(max_workers=len(batches)) as pool:
        for res in pool.map(lambda b: _extract(b, short), batches):
            done += 1
            results.append(res or {})
            log(f"Extract entities and relationships progress: {done}/{len(batches)}")
            if cancelled():
                background.shutdown(wait=False)
                return False

    entities: dict[str, dict] = {}
    rels: dict[tuple[str, str], dict] = {}
    for res in results:
        for e in _items(res, "e", "entities", ("name", "type", "description", "chunks")):
            key = _norm(e.get("name", ""))
            if not key:
                continue
            ent = entities.setdefault(key, {"title": key, "type": "", "descriptions": [], "units": set()})
            etype = str(e.get("type") or "").strip().lower()
            if etype and not ent["type"]:
                ent["type"] = etype
            if e.get("description"):
                ent["descriptions"].append(str(e["description"]).strip())
            ent["units"].update(by_short[str(c)] for c in e.get("chunks") or [] if str(c) in by_short)
        for r in _items(res, "r", "relationships", ("source", "target", "description", "strength", "chunks")):
            s, t = _norm(r.get("source", "")), _norm(r.get("target", ""))
            if not s or not t or s == t:
                continue
            for name in (s, t):
                entities.setdefault(name, {"title": name, "type": "", "descriptions": [], "units": set()})
            key = tuple(sorted((s, t)))
            rel = rels.setdefault(key, {"source": s, "target": t, "descriptions": [], "weight": 0.0,
                                        "units": set()})
            if r.get("description"):
                rel["descriptions"].append(str(r["description"]).strip())
            try:
                rel["weight"] = max(rel["weight"], float(r.get("strength") or 1))
            except (TypeError, ValueError):
                rel["weight"] = max(rel["weight"], 1.0)
            rel["units"].update(by_short[str(c)] for c in r.get("chunks") or [] if str(c) in by_short)
    if not entities:
        log("ERROR Gemini returned no entities for these documents.")
        background.shutdown(wait=False)
        return False

    g = nx.Graph()
    g.add_nodes_from(entities)
    for (s, t), r in rels.items():
        g.add_edge(s, t, weight=r["weight"] or 1.0)
    ent_rows, ent_ids = [], {}
    for i, (key, e) in enumerate(sorted(entities.items())):
        eid = _id("entity", key)
        ent_ids[key] = eid
        desc = " ".join(dict.fromkeys(e["descriptions"]))  # merged, de-duplicated, in order
        ent_rows.append({"id": eid, "human_readable_id": i, "title": key, "type": e["type"] or "topic",
                         "description": desc, "text_unit_ids": sorted(e["units"]),
                         "frequency": max(1, len(e["units"])), "degree": g.degree(key)})
    rel_rows = []
    for i, ((s, t), r) in enumerate(sorted(rels.items())):
        rel_rows.append({"id": _id("rel", s, t), "human_readable_id": i, "source": r["source"],
                         "target": r["target"], "description": " ".join(dict.fromkeys(r["descriptions"])),
                         "weight": float(r["weight"] or 1.0), "combined_degree": g.degree(s) + g.degree(t),
                         "text_unit_ids": sorted(r["units"])})
    log(f"Workflow extract_graph finished ({len(ent_rows)} entities, {len(rel_rows)} relationships)")
    background.submit(prewarm, list(units["text"]) + [f"{e['title']}: {e['description']}" for e in ent_rows])

    # ---- communities: local Louvain clustering, no LLM calls ----
    log("Workflow create_communities started")
    groups = [c for c in nx.community.louvain_communities(g, weight="weight", seed=42) if len(c) > 1]
    groups.sort(key=len, reverse=True)
    rel_by_pair = {tuple(sorted((r["source"], r["target"]))): r for r in rel_rows}
    comm_rows = []
    for n, members in enumerate(groups):
        member_rels = [r for (a, b), r in rel_by_pair.items() if a in members and b in members]
        units_in = sorted({u for m in members for u in entities[m]["units"]})
        comm_rows.append({"id": _id("community", str(n)), "human_readable_id": n, "community": n, "level": 0,
                          "parent": -1, "children": [], "title": f"Community {n}",
                          "entity_ids": [ent_ids[m] for m in sorted(members)],
                          "relationship_ids": [r["id"] for r in member_rels], "text_unit_ids": units_in,
                          "period": time.strftime("%Y-%m-%d"), "size": len(members)})
    log(f"Workflow create_communities finished ({len(comm_rows)} communities)")
    if cancelled():
        background.shutdown(wait=False)
        return False

    # ---- community reports: one call for all communities ----
    log("Workflow create_community_reports started")
    report_rows = []
    if comm_rows:
        lines = []
        for c, members in zip(comm_rows, groups):
            lines.append(f"## Community {c['community']}")
            for m in sorted(members, key=lambda x: -g.degree(x))[:25]:
                lines.append(f"- {m} ({entities[m]['type'] or 'topic'}): "
                             f"{' '.join(entities[m]['descriptions'])[:300]}")
            for (a, b), r in rel_by_pair.items():
                if a in members and b in members:
                    lines.append(f"  * {r['source']} -> {r['target']}: {r['description'][:200]}")
        try:
            out = llm.chat_json(LLM_MODEL_STRONG, REPORT_SYSTEM, "\n".join(lines), REPORT_SCHEMA,
                                reasoning_effort=REASONING)
            reports = {int(r["community"]): r for r in out.get("reports") or [] if str(r.get("community", "")).isdigit()}
        except Exception as err:
            logger.warning("Community reports failed (%s); using entity lists", err)
            reports = {}
        for c, members in zip(comm_rows, groups):
            rep = reports.get(c["community"], {})
            top = sorted(members, key=lambda x: -g.degree(x))
            title = str(rep.get("title") or f"{top[0].title()} and related entities")
            summary = str(rep.get("summary") or "; ".join(m.title() for m in top[:6]))
            c["title"] = title
            report_rows.append({"id": _id("report", str(c["community"])), "human_readable_id": c["community"],
                                "community": c["community"], "level": 0, "parent": -1, "children": [],
                                "title": title, "summary": summary, "full_content": f"# {title}\n\n{summary}",
                                "rank": float(rep.get("rating") or len(members)),
                                "rating_explanation": "", "findings": [],
                                "full_content_json": json.dumps({"title": title, "summary": summary}),
                                "period": c["period"], "size": c["size"]})
    log(f"Workflow create_community_reports finished ({len(report_rows)} reports)")
    background.submit(prewarm, [r["full_content"] for r in report_rows])
    background.shutdown(wait=True)

    # ---- write and promote ----
    shutil.rmtree(STAGING_DIR, ignore_errors=True)
    STAGING_DIR.mkdir(parents=True)
    unit_entities: dict[str, list[str]] = {}
    for e in ent_rows:
        for u in e["text_unit_ids"]:
            unit_entities.setdefault(u, []).append(e["id"])
    unit_rels: dict[str, list[str]] = {}
    for r in rel_rows:
        for u in r["text_unit_ids"]:
            unit_rels.setdefault(u, []).append(r["id"])
    units["entity_ids"] = [unit_entities.get(u, []) for u in units["id"]]
    units["relationship_ids"] = [unit_rels.get(u, []) for u in units["id"]]
    units["covariate_ids"] = [[] for _ in range(len(units))]
    tables = {"documents": docs, "text_units": units, "entities": pd.DataFrame(ent_rows),
              "relationships": pd.DataFrame(rel_rows, columns=["id", "human_readable_id", "source", "target",
                                                               "description", "weight", "combined_degree",
                                                               "text_unit_ids"]),
              "communities": pd.DataFrame(comm_rows, columns=COMMUNITY_COLUMNS),
              "community_reports": pd.DataFrame(report_rows, columns=REPORT_COLUMNS)}
    for name, df in tables.items():
        df.to_parquet(STAGING_DIR / f"{name}.parquet", index=False)
    (STAGING_DIR / "stats.json").write_text(json.dumps({"builder": "fast", "seconds": round(time.perf_counter() - t0, 1),
                                                        **{k: len(v) for k, v in tables.items()}}), encoding="utf-8")
    _promote(STAGING_DIR)
    log(f"Index written in {time.perf_counter() - t0:.1f} s")
    return True
