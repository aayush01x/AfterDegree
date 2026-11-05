"""Onboarding conversation: LLM-run when available, a fixed question flow otherwise."""

from __future__ import annotations

import json
import re
from typing import Any

from pydantic import ValidationError

from . import taxonomy as tx
from .llm import LLM, MENTOR_VOICE
from .schemas import Goals, NextStep, OnboardingChatResponse

MAX_QUESTIONS = 5

INTENT_WORDS = [
    ("masters_abroad", r"master|\bms\b|m\.s\.|\bmsc\b|study|studies|degree|mba|phd"),
    ("job_abroad", r"job abroad|work abroad|move abroad|relocat|job in|work in"),
    ("switch_role", r"switch|change (my )?(role|career|field)|transition|pivot"),
    ("grow_in_place", r"grow|promotion|stay|where i am|current company"),
    ("program_insights", r"program|graduates|placement|our students|university"),
]


def _profile_line(profile: dict) -> str:
    d = profile.get("derived") or {}
    parts = []
    if d.get("undergrad_school"):
        field = d.get("undergrad_field") or "your degree"
        year = f" ({d['undergrad_end_year']})" if d.get("undergrad_end_year") else ""
        parts.append(f"you studied {field} at {tx.short_school(d['undergrad_school'])}{year}")
    if d.get("current_title") and d.get("current_company"):
        parts.append(f"you're now {d['current_title']} at {d['current_company']}")
    elif d.get("current_company"):
        parts.append(f"you're now at {d['current_company']}")
    if d.get("years_experience"):
        parts.append(f"with about {d['years_experience']:g} years of work")
    return ", ".join(parts)


def extract_goals_from_text(texts: list[str], base: Goals) -> Goals:
    goals = base.model_copy(deep=True)
    joined = " ".join(texts)
    low = joined.lower()
    for intent, pattern in INTENT_WORDS:
        if re.search(pattern, low):
            goals.intent = goals.intent or intent  # type: ignore[assignment]
            break
    for alias, country in tx.COUNTRY_ALIASES.items():
        if len(alias) <= 2 and alias not in ("uk", "us"):
            continue
        if re.search(rf"\b{re.escape(alias)}\b", low) and country not in goals.target_countries and country != "India":
            goals.target_countries.append(country)
    for city, country in tx.CITY_COUNTRY.items():
        if re.search(rf"\b{re.escape(city)}\b", low):
            c = tx.canonical_city(city.title()) or city.title()
            if c not in goals.target_cities and country != "India":
                goals.target_cities.append(c)
            if country not in goals.target_countries and country != "India":
                goals.target_countries.append(country)
    for pattern, label in tx.TITLE_FAMILIES:
        if label in ("Engineer (other)", "Manager / Lead", "Analyst", "Founder", "Academic"):
            continue
        if re.search(pattern, low) and label not in goals.target_roles:
            goals.target_roles.append(label)
    if re.search(r"\b(university|placement cell|career office|our graduates|our students)\b", low):
        goals.persona = "university"
    return goals


class Onboarding:
    def __init__(self, llm: LLM | None):
        self.llm = llm

    async def turn(self, profile: dict, messages: list[dict]) -> OnboardingChatResponse:
        base = Goals.model_validate(profile.get("goals") or {})
        if base.persona is None:
            base.persona = (profile.get("derived") or {}).get("persona_guess") or "student_abroad"
        if self.llm is not None and self.llm.available:
            result = await self._llm_turn(profile, messages, base)
            if result is not None:
                return result
        return self.fallback_turn(profile, messages, base)

    # ------------------------------------------------------------ LLM path

    async def _llm_turn(self, profile: dict, messages: list[dict], base: Goals) -> OnboardingChatResponse | None:
        asked = sum(1 for m in messages if m.get("role") == "assistant")
        system = (
            MENTOR_VOICE
            + "\nYou run a short onboarding chat (at most 4 questions in total, one at a time) to confirm the user's profile "
            "and capture their goals. Profile facts: "
            + json.dumps({"derived": profile.get("derived"), "location": (profile.get("person") or {}).get("location")})
            + "\nGoals captured so far: "
            + base.model_dump_json()
            + f"\nQuestions already asked: {asked}. If {MAX_QUESTIONS - 1} or more were asked, or you have persona, intent, "
            "target countries and target roles, set done=true and thank the user briefly."
            "\nReply ONLY as JSON with keys: reply (string), done (boolean), goals (object with persona "
            "[student_abroad|professional|university], intent [masters_abroad|job_abroad|switch_role|grow_in_place|program_insights], "
            "target_roles, target_countries, target_cities, target_companies, institution, programs, constraints), "
            "suggested_replies (2-4 short strings). Use full English country names. Never invent facts about the user."
        )
        convo = [{"role": m["role"], "content": m["content"]} for m in messages if m.get("role") in ("user", "assistant")]
        if not convo:
            convo = [{"role": "user", "content": "Hi, I've just shared my profile."}]
        data = await self.llm.chat_json(system, convo, max_tokens=700)  # type: ignore[union-attr]
        if not data or not isinstance(data.get("reply"), str):
            return None
        try:
            new_goals = Goals.model_validate(data.get("goals") or {})
        except ValidationError:
            new_goals = Goals()
        merged = _merge_goals(base, new_goals)
        done = bool(data.get("done")) or asked >= MAX_QUESTIONS
        suggestions = [s for s in (data.get("suggested_replies") or []) if isinstance(s, str)][:4]
        return OnboardingChatResponse(reply=data["reply"].strip()[:1200], done=done, goals=merged, suggested_replies=suggestions)

    # ------------------------------------------------------------ deterministic path

    def fallback_turn(self, profile: dict, messages: list[dict], base: Goals) -> OnboardingChatResponse:
        user_texts = [m.get("content", "") for m in messages if m.get("role") == "user"]
        answered = len(user_texts)
        goals = extract_goals_from_text(user_texts, base)
        if answered >= 5 and user_texts[4].strip() and not re.match(r"^(no|nothing|none|nope)\b", user_texts[4].strip(), re.I):
            c = user_texts[4].strip()[:200]
            if c not in goals.constraints:
                goals.constraints.append(c)
        university = goals.persona == "university"
        if university and answered >= 2 and not goals.institution:
            goals.institution = (profile.get("derived") or {}).get("current_company")
        line = _profile_line(profile)
        derived = profile.get("derived") or {}

        if answered == 0:
            reply = (
                f"Hi! I'm AfterDegree. From your profile, {line}. Did I get that right?"
                if line
                else "Hi! I'm AfterDegree. I couldn't read much from your profile; could you tell me what you studied and where?"
            )
            sugg = ["Yes, that's right", "Not quite, let me correct it"]
        elif answered == 1:
            if university:
                reply = "Great. Which institution and programs do you represent? I'll look at where your graduates actually work."
                sugg = [derived.get("current_company") or "Our university", "All engineering programs"]
            else:
                reply = (
                    "Thanks! What's your next big step: a master's abroad, a job abroad, switching roles, or growing where you are?"
                )
                sugg = ["A master's abroad", "A job abroad", "Switching roles", "Growing where I am"]
        elif answered == 2:
            reply = "Which countries or cities are you considering? It's fine to name a few, or say you're not sure yet."
            sugg = ["Germany", "Netherlands", "United Kingdom", "Not sure yet"]
        elif answered == 3:
            reply = "Which roles interest you most? For example the job title you'd like in three years."
            fam = tx.title_family(derived.get("current_title")) if derived.get("current_title") else None
            sugg = list(dict.fromkeys(s for s in [fam, "Data Engineer", "Software Engineer", "Data Scientist"] if s and s != "Intern / Working Student"))[:4]
        elif answered == 4:
            reply = "Last one: anything I should keep in mind, like budget, timeline, or languages you speak?"
            sugg = ["Budget under 30 lakh", "I speak some German", "Nothing else"]
        else:
            reply = (
                "Thank you, that's everything I need. I'll start from people with your background and show you "
                "where they ended up and which routes worked, with the evidence for every number."
            )
            sugg = []
        return OnboardingChatResponse(reply=reply, done=answered >= 5, goals=goals, suggested_replies=sugg)


def _merge_goals(base: Goals, new: Goals) -> Goals:
    out = base.model_copy(deep=True)
    for key in ("persona", "intent", "institution"):
        val = getattr(new, key)
        if val:
            setattr(out, key, val)
    for key in ("target_roles", "target_countries", "target_cities", "target_companies", "programs", "constraints"):
        vals = getattr(new, key) or []
        if key == "target_countries":
            vals = [tx.canonical_country(v) or v for v in vals]
        if key == "target_cities":
            vals = [tx.canonical_city(v) or v for v in vals]
        if vals:
            setattr(out, key, list(dict.fromkeys(vals)))
    return out


def home_next_steps(profile: dict, goals: Goals) -> list[NextStep]:
    """The first actions shown after onboarding, chosen deterministically from goals."""
    country = (goals.target_countries or [None])[0]
    city = (goals.target_cities or [None])[0]
    role = (goals.target_roles or [None])[0] or tx.title_family((profile.get("derived") or {}).get("current_title"))
    if role == "Intern / Working Student":
        role = None
    steps: list[NextStep] = []
    if goals.persona == "university":
        params: dict[str, Any] = {"institution": goals.institution, "programs": goals.programs}
        steps.append(NextStep(label="See where your graduates work now", tool="people_like_me", params=params))
        steps.append(NextStep(label="See how your graduates' internships convert", tool="conversion_map", params={"scope": {"school": goals.institution}}))
        if role and country:
            steps.append(NextStep(label=f"Check how crowded {role} roles in {country} are", tool="market_saturation", params={"role": role, "country": country}))
        return steps
    steps.append(NextStep(label="See where people like you are now", tool="people_like_me", params={"match": "exact_school"}))
    if role and country:
        place = f"{city}, {country}" if city else country
        steps.append(NextStep(label=f"Trace routes to {role} in {place}", tool="reverse_gps", params={"role": role, "city": city, "country": country}))
        steps.append(NextStep(label=f"Read current {role} postings in {country}", tool="job_postings", params={"role": role, "country": country, "city": city}))
    if country:
        steps.append(NextStep(label=f"See your Internship-to-Job chances in {country}", tool="internship_chances", params={"country": country}))
        steps.append(NextStep(label=f"Find employers in {country} that hire Indian-educated people", tool="indian_friendly", params={"country": country, "role": role}))
    return steps
