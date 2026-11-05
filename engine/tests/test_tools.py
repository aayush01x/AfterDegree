import json

import pytest
import respx

from afterdegree.mock import FakeCrustdata, generate_jobs, generate_people
from afterdegree.toolkit import MOCK_WARNING, ToolInputError, scrub_result
from afterdegree.tools import TOOLS

from .conftest import riya_profile, route_to_fake
from .helpers import assert_privacy, validate_result

GOALS = {"persona": "student_abroad", "intent": "masters_abroad", "target_roles": ["Data Engineer"], "target_countries": ["Germany"]}

HAPPY = {
    "people_like_me": {"match": "exact_school"},
    "internship_chances": {"country": "Germany"},
    "conversion_map": {"scope": {"country": "Germany"}},
    "reverse_gps": {"goal_text": "Data engineer in Berlin"},
    "routes_to_position": {"role": "Data Engineer", "country": "Germany"},
    "job_postings": {"role": "Data Engineer", "country": "Germany"},
    "indian_friendly": {"country": "Germany"},
    "market_saturation": {"role": "Data Engineer", "city": "Berlin", "country": "Germany"},
}


def mocked_ctx(make_ctx, tool, params, **kw):
    _, model, _ = TOOLS[tool]
    body = model.model_validate({"profile_id": "p_test", **params}).model_dump(exclude={"profile_id"}, exclude_none=True)
    return make_ctx(body, profile=riya_profile(GOALS), **kw)


@pytest.mark.parametrize("tool", list(HAPPY))
async def test_tool_happy_path(tool, make_ctx, crustdata, fake):
    ctx = mocked_ctx(make_ctx, tool, HAPPY[tool])
    run, _, _ = TOOLS[tool]
    result = await run(ctx)
    r = validate_result(result, tool)
    assert r.confidence in ("high", "medium", "low")
    assert r.evidence and all(e.source == "live" for e in r.evidence)
    assert MOCK_WARNING not in r.warnings
    assert_privacy(result.model_dump_json(), fake)
    assert ctx.budget.credits <= ctx.settings.max_credits_per_run
    assert ctx.budget.live_calls <= ctx.settings.max_live_calls_per_run


async def test_people_like_me_numbers_are_consistent(make_ctx, crustdata, fake):
    ctx = mocked_ctx(make_ctx, "people_like_me", {})
    r = await TOOLS["people_like_me"][0](ctx)
    cohort = r.cohort
    assert cohort.match_level == "exact_school" and not cohort.widened and cohort.n_visible >= 10
    # cross-check the cohort size against the fake dataset directly
    from afterdegree.mock import matches

    expected = sum(1 for p in fake.people if matches(p, cohort.filters["crustdata"], "person"))
    assert cohort.n_visible == expected
    moved = next(s for s in r.sections if s.id == "moved_abroad")
    count = moved.data["count"]
    in_cohort = [p for p in fake.people if matches(p, cohort.filters["crustdata"], "person")]
    abroad = sum(1 for p in in_cohort if p["basic_profile"]["location"]["country"] != "India")
    assert count["k"] == abroad and count["n"] == len(in_cohort)
    countries = next(s for s in r.sections if s.id == "countries")
    assert any(i["remainder"] and i["label"] == "Still in India" for i in countries.data["items"])
    assert countries.data["unit"] == "people"
    assert next(i for i in countries.data["items"])["target"] is True  # Germany is Riya's target, listed first
    assert 0 < r.coverage <= 1


async def test_reverse_gps_goal_in_cohort_filters(make_ctx, crustdata):
    ctx = mocked_ctx(make_ctx, "reverse_gps", {"goal_text": "ML engineer in Munich"})
    r = await TOOLS["reverse_gps"][0](ctx)
    goal = r.cohort.filters["goal"]
    assert goal == {"role": "ML engineer", "city": "Munich", "country": "Germany", "company": None}
    assert "Machine Learning Engineer" in r.title


async def test_reverse_gps_requires_goal(make_ctx, crustdata):
    with pytest.raises(ToolInputError):
        await TOOLS["reverse_gps"][0](mocked_ctx(make_ctx, "reverse_gps", {}))


@pytest.fixture
def thin_fake():
    return FakeCrustdata(people=generate_people(50, seed=3), jobs=generate_jobs(120, seed=4))


@pytest.fixture
def thin(thin_fake):
    with respx.mock(assert_all_called=False) as router:
        route_to_fake(router, thin_fake)
        yield router


@pytest.mark.parametrize("tool", list(HAPPY))
async def test_tool_thin_data_path(tool, make_ctx, thin, thin_fake):
    ctx = mocked_ctx(make_ctx, tool, HAPPY[tool])
    result = await TOOLS[tool][0](ctx)
    r = validate_result(result, tool)
    assert r.confidence == "low"
    assert_privacy(result.model_dump_json(), thin_fake)
    for s in r.sections:
        if s.kind == "stat" and s.data.get("count") and s.data["count"]["n"] < 10:
            assert s.data["count"]["share"] is None and "too few" in s.data["count"]["display"]


async def test_thin_cohort_is_widened_and_labelled(make_ctx, thin):
    r = await TOOLS["people_like_me"][0](mocked_ctx(make_ctx, "people_like_me", {}))
    assert r.cohort.widened is True
    assert r.cohort.match_level in ("school_tier", "field_only")
    assert r.cohort.widened_reason and "widened" in r.cohort.widened_reason


async def test_exp_band_filters_and_labels(make_ctx, crustdata):
    ctx = mocked_ctx(make_ctx, "people_like_me", {"exp_band": "1,3"})
    assert ctx.params["exp_band"] == [1.0, 3.0]
    r = await TOOLS["people_like_me"][0](ctx)
    assert "1–3 years of work" in r.cohort.definition
    assert "years_of_experience_raw" in json.dumps(r.cohort.filters)


async def test_budget_stop_returns_partial_result(make_ctx, crustdata):
    ctx = mocked_ctx(make_ctx, "people_like_me", {}, max_live_calls_per_run=3)
    r = await TOOLS["people_like_me"][0](ctx)
    assert any("safety limit" in w for w in r.warnings)
    assert ctx.budget.live_calls <= 3
    assert r.confidence != "high"


async def test_university_lens(make_ctx, crustdata):
    goals = {"persona": "university", "intent": "program_insights", "institution": "Vellore Institute of Technology",
             "programs": ["Computer Science"]}
    ctx = make_ctx({"match": "exact_school"}, profile=riya_profile(goals))
    r = await TOOLS["people_like_me"][0](ctx)
    assert r.title == "Where your graduates are now"
    assert r.cohort.definition.startswith("Your graduates: Vellore Institute of Technology")
    assert r.cohort.filters["institution"] == "Vellore Institute of Technology"


async def test_university_without_institution_is_bad_input(make_ctx, crustdata):
    ctx = make_ctx({}, profile=riya_profile({"persona": "university"}))
    with pytest.raises(ToolInputError):
        await TOOLS["people_like_me"][0](ctx)


async def test_job_postings_requires_country(make_ctx, crustdata):
    ctx = make_ctx({"role": "Data Engineer"}, profile=riya_profile(GOALS))
    with pytest.raises(ToolInputError):
        await TOOLS["job_postings"][0](ctx)


async def test_second_run_is_served_from_cache(make_ctx, crustdata, settings):
    run = TOOLS["job_postings"][0]
    first = mocked_ctx(make_ctx, "job_postings", HAPPY["job_postings"])
    await run(first)
    second = mocked_ctx(make_ctx, "job_postings", HAPPY["job_postings"])
    r = await run(second)
    assert second.budget.live_calls == 0 and second.budget.cached_calls > 0
    assert all(e.source == "cache" for e in r.evidence)


def test_scrub_result_redacts_names_and_urls():
    from afterdegree.schemas import Result

    r = Result(tool="people_like_me", title="t", confidence="low", coverage_note="c", data_date="2026-11-06",
               warnings=["Aarav Sharma at https://www.linkedin.com/in/aarav-x works here"])
    out = scrub_result(r, {"Aarav Sharma"})
    assert "Aarav Sharma" not in out.model_dump_json() and "linkedin.com/in" not in out.model_dump_json()
