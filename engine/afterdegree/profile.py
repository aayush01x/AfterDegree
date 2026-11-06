"""Normalise Crustdata person data into the contract's `person` + `derived` objects,
and parse search profiles into a compact internal form for aggregation."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date
from typing import Any

from . import taxonomy as tx
from .schemas import Derived, EducationEntry, ExperienceEntry, Location, Person

LINKEDIN_RE = re.compile(r"^https?://([a-z]{2,3}\.)?(www\.)?linkedin\.com/in/[^/?#\s]+/?(\?.*)?$", re.I)
UNIVERSITY_EMPLOYER_RE = re.compile(r"\b(university|universität|universiteit|college|institute of technology|iit|nit|school of|academy)\b", re.I)
UNIVERSITY_ROLE_RE = re.compile(
    r"\b(professor|lecturer|dean|faculty|placement|career(s)? (office|services|advisor|counsel)|training and placement|"
    r"program(me)? (director|manager|coordinator)|admissions|registrar|head of department|hod|corporate relations)\b",
    re.I,
)


def normalise_linkedin_url(url: str) -> str | None:
    url = (url or "").strip()
    if not url:
        return None
    if not url.startswith("http"):
        url = "https://" + url
    if not LINKEDIN_RE.match(url):
        return None
    url = url.split("?")[0].rstrip("/")
    url = re.sub(r"^https?://([a-z]{2,3}\.)?(www\.)?linkedin\.com", "https://www.linkedin.com", url, flags=re.I)
    return url


# ------------------------------------------------------------------ helpers


def _get(d: Any, path: str, default=None):
    cur = d
    for part in path.split("."):
        if not isinstance(cur, dict):
            return default
        cur = cur.get(part)
        if cur is None:
            return default
    return cur


def parse_date(value: Any) -> date | None:
    """Accepts '2017-01-01T00:00:00+00:00', '2022-07', '2022', ints, dict{year,month}."""
    if value is None or value == "":
        return None
    if isinstance(value, dict):
        y = value.get("year")
        m = value.get("month") or 1
        return date(int(y), int(m), 1) if y else None
    if isinstance(value, (int, float)):
        y = int(value)
        return date(y, 1, 1) if 1950 < y < 2100 else None
    s = str(value).strip()
    m = re.match(r"^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?", s)
    if not m:
        return None
    y = int(m.group(1))
    mo = int(m.group(2) or 1)
    d = int(m.group(3) or 1)
    try:
        return date(y, max(1, min(12, mo)), max(1, min(28, d)))
    except ValueError:
        return None


def ym(d: date | None) -> str | None:
    return f"{d.year:04d}-{d.month:02d}" if d else None


def years_between(a: date, b: date) -> float:
    return max(0.0, (b - a).days / 365.25)


def _location_text(loc: Any) -> str | None:
    if loc is None:
        return None
    if isinstance(loc, str):
        return loc
    if isinstance(loc, dict):
        return loc.get("raw") or loc.get("full_location") or ", ".join(
            str(loc[k]) for k in ("city", "state", "country") if loc.get(k)
        ) or None
    return None


def _location_country(loc: Any) -> str | None:
    if isinstance(loc, dict) and loc.get("country"):
        return tx.canonical_country(loc["country"])
    return tx.country_from_location_text(_location_text(loc))


# ------------------------------------------------------------------ internal compact form


@dataclass
class Role:
    company: str | None
    company_id: int | None
    title: str | None
    start: date | None
    end: date | None
    current: bool
    seniority: str | None = None
    function: str | None = None
    location: str | None = None
    country: str | None = None
    hq_country: str | None = None
    employment_type: str | None = None

    @property
    def is_intern(self) -> bool:
        if tx.is_intern_title(self.title):
            return True
        et = (self.employment_type or "").lower()
        return "intern" in et

    def company_key(self) -> str | None:
        if self.company_id:
            return f"id:{self.company_id}"
        if self.company:
            return "name:" + re.sub(r"[^a-z0-9]", "", self.company.lower().replace(", inc", "").replace(" gmbh", ""))
        return None

    def years(self, today: date) -> float | None:
        if not self.start:
            return None
        return years_between(self.start, self.end or today)


@dataclass
class School:
    school: str | None
    degree: str | None
    field: str | None
    start_year: int | None
    end_year: int | None
    country: str | None
    level: str | None


@dataclass
class ParsedPerson:
    """A person reduced to what aggregation needs. Never shown to users as-is."""

    person_id: Any
    country: str | None
    city: str | None
    current_title: str | None
    roles: list[Role] = field(default_factory=list)
    schools: list[School] = field(default_factory=list)
    skills: list[str] = field(default_factory=list)
    name: str | None = None  # kept only for the privacy scrubber
    profile_url: str | None = None  # kept only for the privacy scrubber

    def roles_sorted(self) -> list[Role]:
        return sorted(self.roles, key=lambda r: (r.start or date(1900, 1, 1), 0 if r.current else -1))

    def current_roles(self) -> list[Role]:
        return [r for r in self.roles if r.current]

    def primary_current(self) -> Role | None:
        cur = self.current_roles()
        if not cur:
            return None
        return max(cur, key=lambda r: r.start or date(1900, 1, 1))

    def undergrad(self) -> School | None:
        return pick_undergrad(self.schools)


def _parse_role(raw: dict, current: bool) -> Role:
    loc = raw.get("location")
    loc_text = _location_text(loc)
    hq = raw.get("company_headquarters_country") or raw.get("company_hq_country")
    start = parse_date(raw.get("start_date"))
    end = None if current else parse_date(raw.get("end_date"))
    return Role(
        company=raw.get("name") or raw.get("company_name"),
        company_id=raw.get("crustdata_company_id") or raw.get("company_id"),
        title=raw.get("title"),
        start=start,
        end=end,
        current=current,
        seniority=raw.get("seniority_level"),
        function=raw.get("function_category"),
        location=loc_text,
        country=_location_country(loc) if loc else None,
        hq_country=tx.canonical_country(hq) if isinstance(hq, str) else None,
        employment_type=raw.get("employment_type"),
    )


def _parse_school(raw: dict) -> School:
    start_year = raw.get("start_year")
    end_year = raw.get("end_year")
    if start_year is None:
        d = parse_date(raw.get("start_date"))
        start_year = d.year if d else None
    if end_year is None:
        d = parse_date(raw.get("end_date"))
        end_year = d.year if d else None
    country = _location_country(raw.get("location")) if raw.get("location") else None
    name = raw.get("school") or raw.get("name")
    if country is None and tx.looks_indian_school(name):
        country = "India"
    degree = raw.get("degree") or raw.get("degree_name")
    return School(
        school=name,
        degree=degree,
        field=raw.get("field_of_study") or raw.get("field") or field_from_degree(degree),
        start_year=int(start_year) if start_year else None,
        end_year=int(end_year) if end_year else None,
        country=country,
        level=tx.degree_level(degree),
    )


_DEGREE_WORDS_RE = re.compile(
    r"^(bachelor|master|doctor|b\.?\s?tech|m\.?\s?tech|b\.?\s?e\b|m\.?\s?e\b|b\.?\s?sc|m\.?\s?sc|bs\b|ms\b|ba\b|ma\b|mba|phd|"
    r"dual degree|integrated|honou?rs?|minor|degree|diploma|be\b|me\b)", re.I)


def field_from_degree(degree: str | None) -> str | None:
    """'Bachelor of Technology - BTech, Electrical Engineering' -> 'Electrical Engineering';
    'Master of Science in Computer Science' -> 'Computer Science'. None when no field is named."""
    if not degree:
        return None
    text = degree.strip()
    if "," in text:
        tail = text.rsplit(",", 1)[1].strip()
        if tail and not _DEGREE_WORDS_RE.match(tail):
            return tail
    m = re.search(r"\bin\s+([A-Z][A-Za-z&/ ]{2,})$", text) or re.search(r"\bof\s+([A-Z][A-Za-z&/ ]{2,})$", text)
    if m and not _DEGREE_WORDS_RE.match(m.group(1)) and m.group(1).lower() not in {"technology", "science", "engineering", "arts", "commerce"}:
        return m.group(1).strip()
    return None


def still_studying(ug: "School | None", today: date) -> bool:
    """True while the user's first degree hasn't finished (graduation assumed mid-year)."""
    if not ug or not ug.end_year:
        return False
    return ug.end_year > today.year or (ug.end_year == today.year and today.month < 7)


def parse_person(data: dict) -> ParsedPerson:
    """Parse a person record (search profile or enrich person_data)."""
    bp = data.get("basic_profile") or {}
    loc = bp.get("location")
    emp = _get(data, "experience.employment_details") or {}
    roles = [_parse_role(r, True) for r in (emp.get("current") or []) if isinstance(r, dict)]
    roles += [_parse_role(r, False) for r in (emp.get("past") or []) if isinstance(r, dict)]
    schools = [_parse_school(s) for s in (_get(data, "education.schools") or []) if isinstance(s, dict)]
    skills = _get(data, "skills.professional_network_skills") or []
    city = loc.get("city") if isinstance(loc, dict) else None
    country = _location_country(loc) if loc else None
    if city is None and isinstance(loc, dict) and (loc.get("full_location") or loc.get("raw")):
        # Real search profiles often have city=null with the place only in full_location ("Delhi, India").
        parts = [x.strip() for x in str(loc.get("full_location") or loc.get("raw")).split(",") if x.strip()]
        first = tx.clean_city(parts[0]) if parts else ""
        known = tx.country_for_city(first)
        not_region = first.lower() not in {str(loc.get("state") or "").lower(), str(loc.get("country") or "").lower()}
        city = first if first and (known or (len(parts) >= 2 and not_region)) else None
    return ParsedPerson(
        person_id=data.get("crustdata_person_id"),
        country=country,
        city=tx.canonical_city(city) if city else None,
        current_title=bp.get("current_title"),
        roles=roles,
        schools=schools,
        skills=[s for s in skills if isinstance(s, str)],
        name=bp.get("name"),
        profile_url=_get(data, "social_handles.professional_network_identifier.profile_url"),
    )


def pick_undergrad(schools: list[School]) -> School | None:
    bachelors = [s for s in schools if s.level == "Bachelor's"]
    if bachelors:
        return min(bachelors, key=lambda s: s.end_year or 9999)
    candidates = [s for s in schools if s.level not in ("School", "Master's", "MBA", "PhD") and s.school]
    if candidates:
        return min(candidates, key=lambda s: s.end_year or 9999)
    return None


def further_degrees(p: ParsedPerson) -> list[School]:
    ug = p.undergrad()
    out = []
    for s in p.schools:
        if s is ug or s.level in (None, "School", "Bachelor's"):
            continue
        if ug and ug.end_year and s.end_year and s.end_year < ug.end_year:
            continue
        out.append(s)
    return out


def years_of_experience(roles: list[Role], today: date, since: date | None = None) -> float:
    """Union of non-intern role intervals, in years. With `since` (the first degree's graduation),
    school and college-era roles (clubs, part-time gigs) don't count as work experience."""
    intervals = []
    for r in roles:
        if r.is_intern or not r.start:
            continue
        start = max(r.start, since) if since else r.start
        end = r.end or today
        if end > start:
            intervals.append((start, end))
    intervals.sort()
    total = 0.0
    cur_s = cur_e = None
    for s, e in intervals:
        if cur_e is None or s > cur_e:
            if cur_e is not None:
                total += years_between(cur_s, cur_e)
            cur_s, cur_e = s, e
        else:
            cur_e = max(cur_e, e)
    if cur_e is not None:
        total += years_between(cur_s, cur_e)
    return round(total, 1)


def guess_persona(p: ParsedPerson, years_exp: float, today: date | None = None) -> str:
    cur = p.primary_current()
    if cur and cur.company and UNIVERSITY_EMPLOYER_RE.search(cur.company) and UNIVERSITY_ROLE_RE.search(cur.title or ""):
        return "university"
    if today and still_studying(p.undergrad(), today):
        return "student_abroad"
    if years_exp <= 4.5:
        return "student_abroad"
    return "professional"


# ------------------------------------------------------------------ enrich → contract


def extract_person_data(enrich_response: Any) -> dict | None:
    """Pick person_data from a /person/enrich response (top-level array)."""
    items = enrich_response if isinstance(enrich_response, list) else [enrich_response]
    for item in items:
        if not isinstance(item, dict):
            continue
        if item.get("match_status") in ("not_found", "redacted"):
            continue
        matches = item.get("matches") or []
        if matches:
            best = max(matches, key=lambda m: m.get("confidence_score") or 0)
            pdata = best.get("person_data")
            if isinstance(pdata, dict):
                return pdata
    return None


def normalise_profile(person_data: dict, today: date | None = None) -> tuple[Person, Derived]:
    today = today or date.today()
    p = parse_person(person_data)
    bp = person_data.get("basic_profile") or {}
    loc = bp.get("location") if isinstance(bp.get("location"), dict) else {}

    city = p.city or (loc or {}).get("city")
    country = p.country
    person = Person(
        name=bp.get("name"),
        headline=bp.get("headline"),
        location=Location(city=city, country=country),
        education=[
            EducationEntry(
                school=s.school,
                degree=s.degree,
                field=s.field,
                start_year=s.start_year,
                end_year=s.end_year,
                school_country=s.country,
            )
            for s in sorted(p.schools, key=lambda s: (s.end_year or 9999), reverse=True)
        ],
        experience=[
            ExperienceEntry(
                company=r.company,
                company_id=int(r.company_id) if isinstance(r.company_id, (int, float)) or str(r.company_id or "").isdigit() else None,
                title=r.title,
                start_date=ym(r.start),
                end_date=None if r.current else ym(r.end),
                seniority=r.seniority,
                function=r.function,
            )
            for r in sorted(p.roles, key=lambda r: (r.current, r.start or date(1900, 1, 1)), reverse=True)
        ],
        skills=p.skills,
    )
    ug = p.undergrad()
    since = date(ug.end_year, 7, 1) if ug and ug.end_year else None
    yexp = 0.0 if still_studying(ug, today) else years_of_experience(p.roles, today, since)
    cur = p.primary_current()
    field_label = ug.field if ug else None
    derived = Derived(
        undergrad_school=ug.school if ug else None,
        undergrad_field=field_label,
        undergrad_end_year=ug.end_year if ug else None,
        years_experience=yexp,
        current_company=cur.company if cur else None,
        current_title=(cur.title if cur else None) or bp.get("current_title"),
        persona_guess=guess_persona(p, yexp, today),  # type: ignore[arg-type]
    )
    return person, derived


def person_data_from_stored(person: dict) -> dict:
    """Rebuild a minimal enrich-shaped record from a stored contract Person, so profiles saved
    by an older parser can be re-derived without spending credits."""
    loc = (person.get("location") or {})
    cur, past = [], []
    for e in person.get("experience") or []:
        raw = {
            "name": e.get("company"), "crustdata_company_id": e.get("company_id"), "title": e.get("title"),
            "start_date": e.get("start_date"), "end_date": e.get("end_date"),
            "seniority_level": e.get("seniority"), "function_category": e.get("function"),
        }
        (cur if not e.get("end_date") else past).append(raw)
    schools = [
        {"school": s.get("school"), "degree": s.get("degree"), "field_of_study": s.get("field"),
         "start_year": s.get("start_year"), "end_year": s.get("end_year"),
         **({"location": {"country": s["school_country"]}} if s.get("school_country") else {})}
        for s in person.get("education") or []
    ]
    return {
        "basic_profile": {"name": person.get("name"), "headline": person.get("headline"),
                          "location": {"city": loc.get("city"), "country": loc.get("country")}},
        "experience": {"employment_details": {"current": cur, "past": past}},
        "education": {"schools": schools},
        "skills": {"professional_network_skills": person.get("skills") or []},
    }
