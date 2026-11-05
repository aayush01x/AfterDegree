"""OpenRouter chat-completions client. The LLM interprets text and writes short summaries;
it never produces a number. Every output is validated and has a deterministic fallback."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx
from pydantic import BaseModel, ConfigDict, ValidationError, field_validator

from . import taxonomy as tx
from .config import Settings

log = logging.getLogger("afterdegree.llm")

MENTOR_VOICE = (
    "You are AfterDegree, a warm mentor: friendly and encouraging, like a senior who has done it, "
    "honest about uncertainty, never hype, never shaming a university or a user's choices. Plain English for non-native readers."
)


class ParsedGoal(BaseModel):
    model_config = ConfigDict(extra="ignore")
    role: str | None = None
    city: str | None = None
    country: str | None = None
    company: str | None = None

    @field_validator("role", "city", "country", "company", mode="before")
    @classmethod
    def _clean(cls, v: Any) -> str | None:
        if v is None:
            return None
        s = re.sub(r"\s+", " ", str(v)).strip(" .,;:")
        if not s or s.lower() in {"null", "none", "n/a", "any", "unknown"} or len(s) > 80:
            return None
        return s


def validate_goal(goal: ParsedGoal) -> ParsedGoal:
    city = tx.canonical_city(goal.city) if goal.city else None
    country = tx.canonical_country(goal.country) if goal.country else None
    if city and not country:
        country = tx.country_for_city(city)
    if country and country.lower() == (city or "").lower():
        city = None
    return ParsedGoal(role=goal.role, city=city, country=country, company=goal.company)


GOAL_RE = re.compile(r"^(?P<role>.+?)(?:\s+(?:at|@)\s+(?P<company>[^,]+?))?(?:\s+(?:in|at|based in|near)\s+(?P<place>.+))?$", re.I)


def parse_goal_fallback(text: str) -> ParsedGoal:
    """Deterministic 'ROLE [at COMPANY] [in PLACE]' parser."""
    t = re.sub(r"^(i want to (be|become|work as)|become|becoming|work as|working as|as)\s+(an?\s+)?", "", text.strip(), flags=re.I)
    t = t.rstrip(".!? ")
    m = GOAL_RE.match(t)
    role = company = place = None
    if m:
        role, company, place = m.group("role"), m.group("company"), m.group("place")
    else:
        role = t
    city = country = None
    if company and not place and (tx.country_for_city(company) or tx.COUNTRY_ALIASES.get(company.lower())):
        place, company = company, None
    if place:
        for part in [p.strip() for p in re.split(r",|/| or ", place) if p.strip()]:
            if tx.country_for_city(part) and not city:
                city = part
            elif tx.COUNTRY_ALIASES.get(part.lower()) and not country:
                country = part
            elif not city and not country:
                city = part
    role = re.sub(r"^(an?|the)\s+", "", role or "", flags=re.I)
    return validate_goal(ParsedGoal(role=role, city=city, country=country, company=company))


_NUM_RE = re.compile(r"\d[\d,]*(?:\.\d+)?")


def numbers_in(text: str) -> set[str]:
    return {n.replace(",", "").rstrip(".") for n in _NUM_RE.findall(text)}


def summary_is_grounded(summary: str, facts: list[str]) -> bool:
    """Every number the LLM wrote must appear in the facts it was given."""
    allowed = set()
    for f in facts:
        allowed |= numbers_in(f)
    return numbers_in(summary) <= allowed


def _strip_fences(text: str) -> str:
    text = text.strip()
    m = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.S)
    return m.group(1) if m else text


class LLM:
    def __init__(self, settings: Settings, transport: httpx.AsyncBaseTransport | None = None):
        self.settings = settings
        self._transport = transport
        self.last_error = False

    @property
    def available(self) -> bool:
        return bool(self.settings.openrouter_api_key) and not self.settings.mock

    async def _complete(self, messages: list[dict], json_mode: bool, max_tokens: int = 600, temperature: float = 0.2) -> str | None:
        if not self.available:
            return None
        body: dict[str, Any] = {
            "model": self.settings.openrouter_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            body["response_format"] = {"type": "json_object"}
        headers = {
            "Authorization": f"Bearer {self.settings.openrouter_api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "AfterDegree",
        }
        try:
            async with httpx.AsyncClient(timeout=self.settings.llm_timeout_s, transport=self._transport) as client:
                resp = await client.post(f"{self.settings.openrouter_base_url}/chat/completions", json=body, headers=headers)
            if resp.status_code >= 400:
                self.last_error = True
                log.warning("openrouter returned %s", resp.status_code)
                return None
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            self.last_error = False
            return content if isinstance(content, str) else None
        except (httpx.HTTPError, KeyError, IndexError, ValueError, TypeError) as exc:
            self.last_error = True
            log.warning("openrouter call failed: %s", type(exc).__name__)
            return None

    async def chat_json(self, system: str, user: str | list[dict], max_tokens: int = 600) -> dict | None:
        messages = [{"role": "system", "content": system}]
        if isinstance(user, str):
            messages.append({"role": "user", "content": user})
        else:
            messages.extend(user)
        content = await self._complete(messages, json_mode=True, max_tokens=max_tokens)
        if not content:
            return None
        try:
            parsed = json.loads(_strip_fences(content))
        except json.JSONDecodeError:
            return None
        return parsed if isinstance(parsed, dict) else None

    async def parse_goal(self, text: str) -> tuple[ParsedGoal, bool]:
        """Returns (goal, used_llm)."""
        system = (
            "Extract a career goal into JSON with keys role, city, country, company (null when absent). "
            "role is a job title in English (e.g. 'Data Engineer'). country is a full English country name. "
            "Do not invent values that are not in the text. Reply with JSON only."
        )
        data = await self.chat_json(system, text, max_tokens=200)
        if data:
            try:
                goal = validate_goal(ParsedGoal.model_validate(data))
                if goal.role:
                    return goal, True
            except ValidationError:
                pass
        return parse_goal_fallback(text), False

    async def summarize(self, title: str, facts: list[str]) -> str | None:
        if not self.available or not facts:
            return None
        system = (
            MENTOR_VOICE
            + " Write 1 to 3 short sentences summarising the facts for the user. Use only the facts given; "
            "do not add any number that is not in the facts; mention uncertainty when the facts say a group is small. "
            'Reply as JSON: {"summary": "..."}'
        )
        user = f"Topic: {title}\nFacts:\n" + "\n".join(f"- {f}" for f in facts)
        data = await self.chat_json(system, user, max_tokens=300)
        summary = (data or {}).get("summary")
        if not isinstance(summary, str) or not summary.strip():
            return None
        summary = summary.strip()
        if len(summary) > 600 or not summary_is_grounded(summary, facts):
            log.info("dropping ungrounded summary")
            return None
        return summary
