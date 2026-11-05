"""Anonymous career trajectories (CONTRACT Appendix C, PersonCard / PersonDetail).

Binding privacy rules (Crustdata Data Export Terms §3.1–3.2, §4):
- never a name, photo, profile URL, email or Crustdata person id;
- years only (no months or days); durations rounded to 0.5 year;
- ids are opaque HMACs of (profile, person) with a per-server secret, resolvable only for that profile;
- founder/owner roles are generalised (a founder + company name identifies one person).
"""

from __future__ import annotations

import hashlib
import hmac
import re
from collections import Counter
from datetime import date
from typing import Any

from . import taxonomy as tx
from .profile import ParsedPerson, Role, School, years_between, years_of_experience

PERSON_ID_RE = re.compile(r"^pp_[0-9a-f]{16}$")
FOUNDER_RE = re.compile(r"\b(founder|co-?founder|owner|proprietor|self[- ]employed|freelanc\w*|partner at|ceo|chief executive)\b", re.I)
LEVEL_SHORT = {"Bachelor's": "Bachelor's", "Master's": "Master's", "MBA": "MBA", "PhD": "PhD"}


def person_id(secret: str, profile_id: str, crustdata_person_id: Any) -> str:
    digest = hmac.new(secret.encode(), f"{profile_id}:{crustdata_person_id}".encode(), hashlib.sha256).hexdigest()
    return "pp_" + digest[:16]


def half_years(x: float | None) -> float | None:
    if x is None:
        return None
    return round(max(0.0, x) * 2) / 2


def _role_city(r: Role) -> str | None:
    if not r.location:
        return None
    first = r.location.split(",")[0].strip()
    if not first:
        return None
    city = tx.canonical_city(first)
    if not city or (r.country and city.lower() == r.country.lower()) or tx.COUNTRY_ALIASES.get(city.lower()):
        return None
    return city


def _is_founder(r: Role) -> bool:
    return bool(FOUNDER_RE.search(r.title or "")) or (r.seniority in ("Owner / Partner",))


def role_org(r: Role) -> str:
    if _is_founder(r):
        return "Own company or freelance work"
    return r.company or "Company not listed"


def role_title(r: Role) -> str | None:
    if _is_founder(r):
        return "Founder or independent role"
    return r.title


def school_title(s: School) -> str:
    level = LEVEL_SHORT.get(s.level or "", "Degree")
    field_label, _ = tx.normalise_field(s.field)
    return f"{level}, {field_label}" if field_label else level


def build_steps(p: ParsedPerson, today: date) -> list[dict]:
    steps: list[tuple[int, int, dict]] = []
    for s in p.schools:
        if s.level == "School" or not s.school:
            continue
        years = (s.end_year - s.start_year) if (s.start_year and s.end_year) else None
        steps.append((s.start_year or s.end_year or 9999, 0, {
            "kind": "education", "org": s.school, "title": school_title(s), "city": None, "country": s.country,
            "start_year": s.start_year, "end_year": s.end_year, "years": half_years(years) if years is not None else None,
        }))
    for r in p.roles:
        if not r.start and not r.end:
            continue
        country = r.country or None
        yrs = r.years(today)
        steps.append((r.start.year if r.start else 9999, 1, {
            "kind": "internship" if r.is_intern else "work", "org": role_org(r), "title": role_title(r),
            "city": _role_city(r), "country": country,
            "start_year": r.start.year if r.start else None, "end_year": None if r.current else (r.end.year if r.end else None),
            "years": half_years(yrs),
        }))
    steps.sort(key=lambda t: (t[0], t[1]))
    return [_compact(s) for _, _, s in steps]


def _compact(d: dict) -> dict:
    return {k: v for k, v in d.items() if v is not None or k in ("start_year", "end_year")}


def first_abroad_year(p: ParsedPerson, home: str = "India") -> int | None:
    years = [s.start_year or s.end_year for s in p.schools if s.country and s.country != home and s.level not in (None, "School")]
    years += [r.start.year for r in p.roles if r.start and (r.country or None) not in (None, home)]
    years = [y for y in years if y]
    return min(years) if years else None


def path_signature(p: ParsedPerson, home: str = "India") -> list[str]:
    """Coarse, non-identifying route: e.g. ["BTech in India", "Work in India", "MS in Germany", "Working student", "Full-time in Germany"]."""
    events: list[tuple[int, str]] = []
    for s in p.schools:
        if s.level in ("Bachelor's", "Master's", "MBA", "PhD") and (s.start_year or s.end_year):
            short = {"Bachelor's": "Bachelor's", "Master's": "MS", "MBA": "MBA", "PhD": "PhD"}[s.level]
            events.append(((s.start_year or s.end_year), f"{short} in {s.country or 'a country not listed'}"))
    for r in p.roles_sorted():
        if not r.start:
            continue
        where = r.country or (home if r.hq_country == home and not r.country else None)
        if r.is_intern:
            label = "Working student / intern" + (f" in {where}" if where and where != home else "")
        else:
            label = f"Work in {where}" if where else "Work"
        events.append((r.start.year, label))
    events.sort(key=lambda t: t[0])
    out: list[str] = []
    for _, label in events:
        if not out or out[-1] != label:
            out.append(label)
    return out[:7]


def tags_for(p: ParsedPerson, steps: list[dict], home: str = "India") -> list[str]:
    tags: list[str] = []
    abroad = first_abroad_year(p, home)
    if abroad and (p.country and p.country != home):
        tags.append(f"Moved abroad {abroad}")
    elif p.country == home:
        tags.append("Based in India")
    sig = path_signature(p, home)
    ms = any(x.startswith("MS in") and not x.endswith(home) for x in sig)
    ws = any(x.startswith("Working student / intern in") for x in sig)
    ft_abroad = any(x.startswith("Work in") and not x.endswith(home) and x != "Work" for x in sig)
    if ms and ws and ft_abroad:
        tags.append("MS → working student → full-time")
    elif ms and ft_abroad:
        tags.append("MS abroad → job abroad")
    elif ft_abroad and not ms:
        moved_with = _same_company_transfer(p, home)
        tags.append("Transfer with the same employer" if moved_with else "Hired abroad directly")
    return tags[:3]


def _same_company_transfer(p: ParsedPerson, home: str) -> bool:
    by_company: dict[str, set] = {}
    for r in p.roles:
        key = r.company_key()
        if key and r.country:
            by_company.setdefault(key, set()).add(r.country == home)
    return any(len(v) == 2 for v in by_company.values())


def headline_for(p: ParsedPerson) -> tuple[str, dict | None]:
    cur = p.primary_current()
    if not cur:
        bits = ["Career path"] + ([p.city] if p.city else []) + ([p.country] if p.country and not p.city else [])
        return " · ".join(bits), None
    title = role_title(cur)
    fam = tx.title_family(title) if title else None
    org = role_org(cur)
    city = p.city or _role_city(cur)
    current = {"title": fam or title, "company": org, "city": city, "country": p.country or cur.country,
               "since_year": cur.start.year if cur.start else None}
    bits = [x for x in (fam or title, org, city) if x]
    return " · ".join(bits), {k: v for k, v in current.items() if v is not None}


def match_reasons(p: ParsedPerson, user: dict, today: date) -> list[str]:
    derived = user.get("derived") or {}
    out = []
    ug = p.undergrad()
    u_school = (derived.get("undergrad_school") or "").lower()
    if ug and ug.school and u_school:
        a, b = tx.short_school(ug.school) or "", tx.short_school(derived.get("undergrad_school")) or ""
        if a.lower() == b.lower() or (tx.school_tier(ug.school) and tx.school_tier(ug.school) == tx.school_tier(derived.get("undergrad_school"))
                                      and a.lower()[:12] == b.lower()[:12]):
            out.append("Same college")
        elif tx.school_tier(ug.school) and tx.school_tier(ug.school) == tx.school_tier(derived.get("undergrad_school")):
            out.append("Similar college")
    u_field, _ = tx.normalise_field(derived.get("undergrad_field"))
    p_field, _ = tx.normalise_field(ug.field if ug else None)
    if u_field and p_field and u_field == p_field:
        out.append("Same field")
    u_years = derived.get("years_experience")
    if u_years is not None:
        mine = years_of_experience([r for r in p.roles if r.start and (not ug or not ug.end_year or r.start.year >= ug.end_year)], today)
        if ug and ug.end_year and derived.get("undergrad_end_year") and abs(ug.end_year - int(derived["undergrad_end_year"])) <= 2:
            out.append("Graduated around the same time")
        elif abs(mine - float(u_years)) <= 1.5:
            out.append("Similar experience")
    u_company = (derived.get("current_company") or "").lower()
    if u_company and any((r.company or "").lower() == u_company for r in p.roles):
        out.append(f"Also worked at {derived.get('current_company')}")
    return out[:4]


def card_for(p: ParsedPerson, pid: str, user: dict, today: date) -> dict:
    steps = build_steps(p, today)
    headline, current = headline_for(p)
    card: dict[str, Any] = {"id": pid, "headline": headline, "match_reasons": match_reasons(p, user, today),
                            "tags": tags_for(p, steps), "steps": steps}
    if current:
        card["current"] = current
    return card


def top_skills(p: ParsedPerson, n: int = 8) -> list[str]:
    seen: list[str] = []
    for s in p.skills:
        norm = tx.normalise_skill(s)
        if norm and norm not in seen:
            seen.append(norm)
        if len(seen) >= n:
            break
    return seen


def signature_counts(people: list[ParsedPerson]) -> Counter:
    return Counter(tuple(path_signature(p)) for p in people)


# ------------------------------------------------------------------ privacy checks

NAME_KEYS = {"name", "first_name", "last_name", "full_name", "profile_url", "linkedin", "linkedin_url", "email", "emails",
             "photo", "photo_url", "profile_picture", "picture", "crustdata_person_id", "person_id_raw"}
URL_RE = re.compile(r"https?://[^\s\"']+", re.I)
FULL_DATE_RE = re.compile(r"\b(19|20)\d{2}-(0[1-9]|1[0-2])(-\d{2})?\b")


def privacy_violations(obj: Any, sensitive: set[str] | None = None, allow_url_keys: tuple[str, ...] = ("posting_url",),
                       path: str = "$") -> list[str]:
    """Names / URLs / full dates found in person-facing output (used by the engine before returning, and by tests)."""
    found: list[str] = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in NAME_KEYS and v not in (None, "", []):
                found.append(f"{path}.{k}: forbidden key")
            if k in allow_url_keys:
                continue
            found += privacy_violations(v, sensitive, allow_url_keys, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            found += privacy_violations(v, sensitive, allow_url_keys, f"{path}[{i}]")
    elif isinstance(obj, str):
        if URL_RE.search(obj):
            found.append(f"{path}: url")
        if FULL_DATE_RE.search(obj):
            found.append(f"{path}: full date")
        for s in sensitive or ():
            if len(s) >= 6 and " " in s and s in obj:
                found.append(f"{path}: sensitive value")
    return found


def scrub_person_output(obj: Any, sensitive: set[str], allow_url_keys: tuple[str, ...] = ("posting_url",)) -> Any:
    """Remove anything that slipped through: URLs (other than allowed posting links), full dates, names."""
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            if k in NAME_KEYS:
                continue
            out[k] = v if k in allow_url_keys else scrub_person_output(v, sensitive, allow_url_keys)
        return out
    if isinstance(obj, list):
        return [scrub_person_output(v, sensitive, allow_url_keys) for v in obj]
    if isinstance(obj, str):
        s = URL_RE.sub("[link hidden]", obj)
        s = FULL_DATE_RE.sub(lambda m: m.group(0)[:4], s)
        for name in sorted(sensitive, key=len, reverse=True):
            if len(name) >= 6 and " " in name and name in s:
                s = s.replace(name, "[hidden]")
        return s
    return obj


def years_in_country(p: ParsedPerson, country: str, today: date) -> float | None:
    starts = [r.start for r in p.roles if r.start and r.country == country]
    starts += [date(s.start_year, 9, 1) for s in p.schools if s.start_year and s.country == country and s.level not in (None, "School")]
    if not starts:
        return None
    return years_between(min(starts), today)
