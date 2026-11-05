import json

import httpx
import pytest
import respx

from afterdegree.llm import LLM, parse_goal_fallback, summary_is_grounded
from afterdegree.onboarding import Onboarding, extract_goals_from_text, home_next_steps
from afterdegree.schemas import Goals

from .conftest import riya_profile

OR_URL = "https://openrouter.ai/api/v1/chat/completions"


def completion(content) -> httpx.Response:
    text = content if isinstance(content, str) else json.dumps(content)
    return httpx.Response(200, json={"choices": [{"message": {"role": "assistant", "content": text}}]})


@pytest.fixture
def llm_settings(settings):
    settings.openrouter_api_key = "or-test-key"
    return settings


@pytest.mark.parametrize("text,expected", [
    ("ML engineer in Berlin", ("ML engineer", "Berlin", "Germany", None)),
    ("Data Engineer at Zalando in Berlin", ("Data Engineer", "Berlin", "Germany", "Zalando")),
    ("I want to become a data scientist in the Netherlands", ("data scientist", None, "Netherlands", None)),
    ("Product manager", ("Product manager", None, None, None)),
    ("software engineer in Bangalore", ("software engineer", "Bengaluru", "India", None)),
])
def test_goal_fallback_parser(text, expected):
    g = parse_goal_fallback(text)
    assert (g.role, g.city, g.country, g.company) == expected


async def test_llm_unavailable_without_key(settings):
    llm = LLM(settings)
    assert not llm.available
    goal, used = await llm.parse_goal("Data engineer in Amsterdam")
    assert not used and goal.country == "Netherlands"
    assert await llm.summarize("x", ["fact 1"]) is None


async def test_llm_parse_goal_validates(llm_settings):
    llm = LLM(llm_settings)
    with respx.mock() as router:
        route = router.post(OR_URL).mock(return_value=completion({"role": "Machine Learning Engineer", "city": "münchen", "country": None, "company": "null"}))
        goal, used = await llm.parse_goal("I'd love to do ML in Munich")
    assert used
    assert (goal.role, goal.city, goal.country, goal.company) == ("Machine Learning Engineer", "Munich", "Germany", None)
    sent = json.loads(route.calls[0].request.content)
    assert sent["model"] == llm_settings.openrouter_model
    assert sent["response_format"] == {"type": "json_object"}
    assert route.calls[0].request.headers["authorization"] == "Bearer or-test-key"


async def test_llm_bad_output_falls_back(llm_settings):
    llm = LLM(llm_settings)
    with respx.mock() as router:
        router.post(OR_URL).mock(return_value=completion("not json at all"))
        goal, used = await llm.parse_goal("Data engineer in Dublin")
    assert not used and goal.city == "Dublin" and goal.country == "Ireland"


async def test_llm_http_error_falls_back(llm_settings):
    llm = LLM(llm_settings)
    with respx.mock() as router:
        router.post(OR_URL).mock(return_value=httpx.Response(500, json={}))
        goal, used = await llm.parse_goal("Data engineer in Dublin")
    assert not used and llm.last_error


def test_summary_grounding():
    facts = ["Moved abroad: at least 73 of 134 (54%)."]
    assert summary_is_grounded("About 54% of people like you moved abroad (73 of 134).", facts)
    assert not summary_is_grounded("Nearly 80% moved abroad.", facts)


async def test_summary_rejects_invented_numbers(llm_settings):
    llm = LLM(llm_settings)
    with respx.mock() as router:
        router.post(OR_URL).mock(side_effect=[completion({"summary": "Over 90% of people like you moved abroad!"}),
                                              completion({"summary": "Most people like you (73 of 134) now live abroad."})])
        assert await llm.summarize("t", ["Moved abroad: at least 73 of 134."]) is None
        assert await llm.summarize("t", ["Moved abroad: at least 73 of 134."]) == "Most people like you (73 of 134) now live abroad."


async def test_onboarding_fallback_flow():
    ob = Onboarding(None)
    profile = riya_profile()
    msgs = []
    answers = ["Yes, that's right", "A master's abroad", "Germany, maybe Berlin or the Netherlands", "Data Engineer", "Budget under 30 lakh"]
    first = await ob.turn(profile, msgs)
    assert "Vellore Institute of Technology" in first.reply and not first.done and first.suggested_replies
    resp = first
    for a in answers:
        msgs += [{"role": "assistant", "content": resp.reply}, {"role": "user", "content": a}]
        resp = await ob.turn(profile, msgs)
    assert resp.done
    g = resp.goals
    assert g.intent == "masters_abroad" and g.persona == "student_abroad"
    assert g.target_countries[:2] == ["Germany", "Netherlands"] and "Berlin" in g.target_cities
    assert g.target_roles == ["Data Engineer"]
    assert g.constraints == ["Budget under 30 lakh"]


async def test_onboarding_llm_turn(llm_settings):
    ob = Onboarding(LLM(llm_settings))
    with respx.mock() as router:
        router.post(OR_URL).mock(return_value=completion({
            "reply": "Lovely! Which cities in Germany appeal to you?", "done": False,
            "goals": {"persona": "student_abroad", "intent": "masters_abroad", "target_countries": ["germany"], "target_roles": ["Data Engineer"],
                      "unexpected": "ignored"},
            "suggested_replies": ["Berlin", "Munich", 3]}))
        resp = await ob.turn(riya_profile(), [{"role": "user", "content": "I want to do an MS in Germany"}])
    assert resp.reply.startswith("Lovely") and not resp.done
    assert resp.goals.target_countries == ["Germany"]
    assert resp.suggested_replies == ["Berlin", "Munich"]


async def test_onboarding_llm_garbage_uses_fallback(llm_settings):
    ob = Onboarding(LLM(llm_settings))
    with respx.mock() as router:
        router.post(OR_URL).mock(return_value=completion({"nope": True}))
        resp = await ob.turn(riya_profile(), [])
    assert "Did I get that right" in resp.reply


def test_extract_goals_and_home_steps():
    g = extract_goals_from_text(["I want a job abroad in London as a data scientist"], Goals(persona="professional"))
    assert g.intent == "job_abroad" and g.target_countries == ["United Kingdom"] and g.target_roles == ["Data Scientist"]
    steps = home_next_steps(riya_profile(), g)
    tools = [s.tool for s in steps]
    assert tools[0] == "people_like_me" and "reverse_gps" in tools and "indian_friendly" in tools
