"""Offline test of the fast builder: fake Gemini replies, real chunking, clustering and parquet output."""
import pandas as pd

from backend import engine, fast_index, llm
from backend.stores import vector_store


def test_fast_build_writes_graphrag_tables(tmp_path, monkeypatch):
    inp = tmp_path / "input"
    inp.mkdir()
    (inp / "a.txt").write_text("Acme Corp hired Jane Doe. Jane Doe leads Project Falcon in Pune.", encoding="utf-8")
    (inp / "b.txt").write_text("Project Falcon is funded by Orbit Bank.", encoding="utf-8")
    out = tmp_path / "output"
    monkeypatch.setattr(fast_index, "INPUT_DIR", inp)
    monkeypatch.setattr(fast_index, "STAGING_DIR", tmp_path / "staging")
    monkeypatch.setattr(engine, "_promote", lambda staging: staging.rename(out))
    monkeypatch.setattr(vector_store, "prewarm", lambda texts: None)

    def fake_chat_json(model, system, user, schema_hint="", reasoning_effort=None):
        if "community" in schema_hint:
            return {"reports": [{"community": 0, "title": "Project Falcon", "summary": "Falcon links Acme, "
                                 "Jane Doe and Orbit Bank.", "rating": 8}]}
        chunk = "1" if "Acme" in user else "2"
        if chunk == "1":
            return {"e": [["Acme Corp", "organization", "A company.", [1]], ["Jane Doe", "person", "Leads Falcon.", [1]],
                          ["Project Falcon", "project", "A project in Pune.", [1]]],
                    "r": [["Acme Corp", "Jane Doe", "Acme hired Jane Doe.", 7, [1]],
                          ["Jane Doe", "Project Falcon", "Jane Doe leads Falcon.", 9, [1]]]}
        return {"e": [["Orbit Bank", "organization", "A bank.", [2]], ["project falcon", "project", "Funded.", [2]]],
                "r": [["Orbit Bank", "Project Falcon", "Orbit Bank funds Falcon.", 8, [2]]]}

    monkeypatch.setattr(llm, "chat_json", fake_chat_json)
    lines = []
    assert fast_index.build(lines.append)

    ents = pd.read_parquet(out / "entities.parquet")
    rels = pd.read_parquet(out / "relationships.parquet")
    reports = pd.read_parquet(out / "community_reports.parquet")
    assert set(ents["title"]) == {"ACME CORP", "JANE DOE", "PROJECT FALCON", "ORBIT BANK"}  # names merged
    falcon = ents.set_index("title").loc["PROJECT FALCON"]
    assert falcon["degree"] == 2 and len(falcon["text_unit_ids"]) == 2  # supported by both documents
    assert len(rels) == 3 and "Project Falcon" in set(reports["title"])
    assert any("Workflow extract_graph finished" in line for line in lines)
    for name in fast_index.STAGING_DIR.parent.glob("output/*.parquet"):
        assert pd.read_parquet(name) is not None
