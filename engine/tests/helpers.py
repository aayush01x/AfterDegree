from afterdegree.schemas import SECTION_DATA_MODELS, Result

# (id, kind) per tool, as the web views read them (web/src/features/*/View.tsx).
EXPECTED_SECTIONS = {
    "people_like_me": [("cohort_size", "stat"), ("moved_abroad", "stat"), ("countries", "distribution"), ("roles", "ranked_table"),
                       ("employers_target", "ranked_table"), ("further_degrees", "distribution"), ("degree_countries", "distribution")],
    "internship_chances": [("chance", "stat"), ("companies", "ranked_table"), ("method", "text")],
    "conversion_map": [("companies", "ranked_table"), ("by_country", "distribution")],
    "reverse_gps": [("goal", "text"), ("routes", "route_list"), ("graph", "routes"), ("skills_gap", "keywords")],
    "routes_to_position": [("graph", "routes"), ("feeders", "ranked_table"), ("titles", "ranked_table"), ("schools", "ranked_table"),
                           ("years", "distribution")],
    "job_postings": [("open_90", "stat"), ("open_30", "stat"), ("open_prev", "stat"), ("trend", "timeseries"), ("seniority", "distribution"),
                     ("skills", "keywords"), ("languages", "distribution"), ("visa", "stat"), ("employers", "ranked_table")],
    "indian_friendly": [("employers", "ranked_table"), ("method", "text")],
    "market_saturation": [("ratio", "stat"), ("trend", "timeseries"), ("read", "text"), ("cities", "ranked_table"),
                          ("entrants", "stat"), ("openings", "stat")],
}


def validate_result(result, tool: str) -> Result:
    data = result if isinstance(result, dict) else result.model_dump(by_alias=True)
    r = Result.model_validate(data)
    assert r.tool == tool
    got = [(s.id, s.kind) for s in r.sections]
    expected = EXPECTED_SECTIONS[tool]
    assert got[: len(expected)] == expected, got
    ids = {e.id for e in r.evidence}
    for s in r.sections:
        SECTION_DATA_MODELS[s.kind].model_validate(s.data)
        assert set(s.evidence_ids) <= ids, "section references unknown evidence"
        for c in _counts(s.data):
            assert set(c.get("evidence_ids") or []) <= ids, "Count references unknown evidence"
        if s.kind == "stat":
            assert not s.data["label"].lower().startswith("of "), "hero renders 'of N {label}'"
        _check_privacy_floor(s)
    assert r.next_steps, "every result ends with a next step"
    assert r.data_date and r.coverage_note
    assert r.coverage is None or 0.0 <= r.coverage <= 1.0
    if tool == "reverse_gps":
        assert set(r.cohort.filters["goal"]) == {"role", "city", "country", "company"}
    return r


def _check_privacy_floor(s) -> None:
    """Rows/items naming a group must stand for at least 5 people."""
    if s.kind == "distribution" and s.data.get("unit") in ("people", "degrees", "conversions"):
        for item in s.data["items"]:
            if not item.get("remainder") and not item["label"].startswith("Other"):
                assert item["count"] >= 5, (s.id, item)
    if s.kind == "ranked_table":
        for row in s.data["rows"]:
            if row.get("rest"):
                continue
            people = row["cells"].get("people", row["cells"].get("hires") if s.id == "employers" and "recent" in row["cells"] else None)
            if isinstance(people, int):
                assert people >= 5, (s.id, row)
            if s.id == "companies":
                seen = row["cells"].get("seen", row["cells"].get("interns"))
                assert seen >= 5, (s.id, row)


def _counts(obj):
    if isinstance(obj, dict):
        if {"k", "n", "display"} <= obj.keys():
            yield obj
        for v in obj.values():
            yield from _counts(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _counts(v)


def assert_privacy(result_json: str, fake) -> None:
    low = result_json.lower()
    assert "linkedin.com/in/" not in low
    for p in fake.people:
        name = p["basic_profile"]["name"]
        assert name not in result_json, f"leaked a name: {name}"
