"""Deterministic vocabularies: countries, cities, school tiers, fields, titles, skills, languages, visa wording."""

from __future__ import annotations

import re
from dataclasses import dataclass

# ------------------------------------------------------------------ countries & cities

COUNTRY_ALIASES: dict[str, str] = {
    "us": "United States",
    "usa": "United States",
    "u.s.": "United States",
    "u.s.a.": "United States",
    "america": "United States",
    "united states of america": "United States",
    "united states": "United States",
    "uk": "United Kingdom",
    "u.k.": "United Kingdom",
    "england": "United Kingdom",
    "scotland": "United Kingdom",
    "britain": "United Kingdom",
    "great britain": "United Kingdom",
    "united kingdom": "United Kingdom",
    "de": "Germany",
    "deutschland": "Germany",
    "germany": "Germany",
    "nl": "Netherlands",
    "holland": "Netherlands",
    "the netherlands": "Netherlands",
    "netherlands": "Netherlands",
    "ie": "Ireland",
    "ireland": "Ireland",
    "in": "India",
    "india": "India",
    "ca": "Canada",
    "canada": "Canada",
    "au": "Australia",
    "australia": "Australia",
    "fr": "France",
    "france": "France",
    "se": "Sweden",
    "sweden": "Sweden",
    "ch": "Switzerland",
    "switzerland": "Switzerland",
    "sg": "Singapore",
    "singapore": "Singapore",
    "uae": "United Arab Emirates",
    "dubai": "United Arab Emirates",
    "united arab emirates": "United Arab Emirates",
    "nz": "New Zealand",
    "new zealand": "New Zealand",
    "finland": "Finland",
    "denmark": "Denmark",
    "norway": "Norway",
    "austria": "Austria",
    "belgium": "Belgium",
    "spain": "Spain",
    "italy": "Italy",
    "poland": "Poland",
    "portugal": "Portugal",
    "japan": "Japan",
}

# Stored spellings differ between rows ("United States" vs "United States of America").
COUNTRY_VARIANTS: dict[str, list[str]] = {
    "United States": ["United States", "United States of America"],
    "United Kingdom": ["United Kingdom"],
    "Netherlands": ["Netherlands", "The Netherlands"],
}

ISO2: dict[str, str] = {
    "United States": "US",
    "United Kingdom": "GB",
    "Germany": "DE",
    "Netherlands": "NL",
    "Ireland": "IE",
    "India": "IN",
    "Canada": "CA",
    "Australia": "AU",
    "France": "FR",
    "Sweden": "SE",
    "Switzerland": "CH",
    "Singapore": "SG",
    "United Arab Emirates": "AE",
}

CITY_COUNTRY: dict[str, str] = {
    "berlin": "Germany",
    "munich": "Germany",
    "münchen": "Germany",
    "hamburg": "Germany",
    "frankfurt": "Germany",
    "stuttgart": "Germany",
    "cologne": "Germany",
    "köln": "Germany",
    "düsseldorf": "Germany",
    "dusseldorf": "Germany",
    "amsterdam": "Netherlands",
    "rotterdam": "Netherlands",
    "eindhoven": "Netherlands",
    "utrecht": "Netherlands",
    "the hague": "Netherlands",
    "den haag": "Netherlands",
    "delft": "Netherlands",
    "london": "United Kingdom",
    "manchester": "United Kingdom",
    "edinburgh": "United Kingdom",
    "cambridge": "United Kingdom",
    "birmingham": "United Kingdom",
    "dublin": "Ireland",
    "cork": "Ireland",
    "toronto": "Canada",
    "vancouver": "Canada",
    "montreal": "Canada",
    "waterloo": "Canada",
    "new york": "United States",
    "san francisco": "United States",
    "seattle": "United States",
    "boston": "United States",
    "austin": "United States",
    "chicago": "United States",
    "bengaluru": "India",
    "bangalore": "India",
    "hyderabad": "India",
    "pune": "India",
    "chennai": "India",
    "mumbai": "India",
    "delhi": "India",
    "gurugram": "India",
    "gurgaon": "India",
    "noida": "India",
    "sydney": "Australia",
    "melbourne": "Australia",
    "stockholm": "Sweden",
    "zurich": "Switzerland",
    "zürich": "Switzerland",
    "paris": "France",
    "singapore": "Singapore",
}

CITY_VARIANTS: dict[str, list[str]] = {
    "Munich": ["Munich", "München"],
    "Cologne": ["Cologne", "Köln"],
    "Düsseldorf": ["Düsseldorf", "Dusseldorf"],
    "The Hague": ["The Hague", "Den Haag"],
    "Bengaluru": ["Bengaluru", "Bangalore"],
    "Gurugram": ["Gurugram", "Gurgaon"],
    "Zurich": ["Zurich", "Zürich"],
}
CITY_CANONICAL = {v.lower(): k for k, vs in CITY_VARIANTS.items() for v in vs}

COMPARABLE_CITIES: dict[str, list[str]] = {
    "Germany": ["Berlin", "Munich", "Hamburg", "Frankfurt", "Stuttgart"],
    "Netherlands": ["Amsterdam", "Rotterdam", "Eindhoven", "Utrecht"],
    "United Kingdom": ["London", "Manchester", "Edinburgh", "Cambridge"],
    "Ireland": ["Dublin", "Cork"],
    "Canada": ["Toronto", "Vancouver", "Montreal"],
    "United States": ["New York", "San Francisco", "Seattle", "Boston", "Austin"],
    "India": ["Bengaluru", "Hyderabad", "Pune", "Chennai"],
    "Australia": ["Sydney", "Melbourne"],
}


def canonical_country(value: str | None) -> str | None:
    if not value:
        return None
    v = value.strip()
    return COUNTRY_ALIASES.get(v.lower(), v.title() if v.islower() else v)


def country_variants(country: str) -> list[str]:
    c = canonical_country(country) or country
    return COUNTRY_VARIANTS.get(c, [c])


def canonical_city(value: str | None) -> str | None:
    if not value:
        return None
    v = value.strip()
    return CITY_CANONICAL.get(v.lower(), v.title() if v.islower() else v)


def city_variants(city: str) -> list[str]:
    c = canonical_city(city) or city
    return CITY_VARIANTS.get(c, [c])


def country_for_city(city: str | None) -> str | None:
    if not city:
        return None
    return CITY_COUNTRY.get(city.strip().lower())


def country_from_location_text(text: str | None) -> str | None:
    """Best-effort country from a raw location string like 'Munich, Bavaria, Germany'."""
    if not text:
        return None
    parts = [p.strip() for p in re.split(r"[,|]", text) if p.strip()]
    for part in reversed(parts):
        c = COUNTRY_ALIASES.get(part.lower())
        if c:
            return c
        c = country_for_city(part)
        if c:
            return c
    low = text.lower()
    for alias, c in COUNTRY_ALIASES.items():
        if len(alias) > 3 and re.search(rf"\b{re.escape(alias)}\b", low):
            return c
    for city, c in CITY_COUNTRY.items():
        if re.search(rf"\b{re.escape(city)}\b", low):
            return c
    return None


# ------------------------------------------------------------------ schools

@dataclass(frozen=True)
class SchoolTier:
    key: str
    label: str
    phrases: tuple[str, ...]


SCHOOL_TIERS: tuple[SchoolTier, ...] = (
    SchoolTier("iit", "IITs", ("Indian Institute of Technology",)),
    SchoolTier("nit", "NITs", ("National Institute of Technology",)),
    SchoolTier(
        "iiit",
        "IIITs",
        ("International Institute of Information Technology", "Indian Institute of Information Technology"),
    ),
    SchoolTier("bits", "BITS", ("Birla Institute of Technology and Science", "BITS Pilani")),
    SchoolTier(
        "private_t1",
        "leading private engineering universities (VIT, Manipal, SRM, Amrita, Thapar, PES and similar)",
        (
            "Vellore Institute of Technology",
            "VIT University",
            "Manipal Institute of Technology",
            "Manipal Academy of Higher Education",
            "Manipal University",
            "SRM Institute of Science and Technology",
            "SRM University",
            "Amrita Vishwa Vidyapeetham",
            "Thapar Institute of Engineering",
            "PES University",
            "Kalinga Institute of Industrial Technology",
            "Shiv Nadar University",
            "Symbiosis Institute of Technology",
            "Nirma University",
        ),
    ),
    SchoolTier(
        "state",
        "state engineering universities and colleges (Anna, VTU, JNTU, Mumbai, Pune and similar)",
        (
            "Anna University",
            "Visvesvaraya Technological University",
            "Jawaharlal Nehru Technological University",
            "Savitribai Phule Pune University",
            "University of Mumbai",
            "Delhi Technological University",
            "Netaji Subhas University of Technology",
            "College of Engineering",
            "Osmania University",
            "Jadavpur University",
        ),
    ),
)

INDIA_SCHOOL_HINTS = (
    "india",
    "indian institute",
    "iit ",
    "nit ",
    "vellore",
    "vit",
    "manipal",
    "srm",
    "amrita",
    "thapar",
    "pes university",
    "anna university",
    "visvesvaraya",
    "jawaharlal nehru",
    "pune",
    "mumbai",
    "delhi",
    "bangalore",
    "bengaluru",
    "hyderabad",
    "chennai",
    "kolkata",
    "jadavpur",
    "osmania",
    "birla institute",
    "bits pilani",
    "kalinga",
    "symbiosis",
    "nirma",
)


def school_tier(school: str | None) -> SchoolTier | None:
    if not school:
        return None
    low = school.lower()
    for tier in SCHOOL_TIERS:
        for phrase in tier.phrases:
            if phrase.lower() in low:
                return tier
    if re.search(r"\biit\b", low):
        return SCHOOL_TIERS[0]
    if re.search(r"\bnit\b", low):
        return SCHOOL_TIERS[1]
    return None


def looks_indian_school(school: str | None) -> bool:
    if not school:
        return False
    low = f" {school.lower()} "
    return school_tier(school) is not None or any(h in low for h in INDIA_SCHOOL_HINTS)


def short_school(school: str | None) -> str | None:
    if not school:
        return None
    s = re.sub(r"\s*[-–|(].*$", "", school).strip()
    return s or school


# ------------------------------------------------------------------ fields of study

FIELD_RULES: tuple[tuple[str, str, str], ...] = (
    # (regex on lowercase field, canonical label, search phrase)
    (r"computer science|\bcse\b|computer engineering|computer sc|software engineering", "Computer Science", "Computer Science"),
    (r"information technology|\bit\b|information science", "Information Technology", "Information Technology"),
    (r"electronics|\bece\b|communication engineering|telecommunication", "Electronics and Communication", "Electronics"),
    (r"electrical|\beee\b", "Electrical Engineering", "Electrical"),
    (r"mechanical|\bmech\b", "Mechanical Engineering", "Mechanical"),
    (r"civil", "Civil Engineering", "Civil"),
    (r"chemical", "Chemical Engineering", "Chemical"),
    (r"data science|artificial intelligence|machine learning|\bai\b", "Data Science / AI", "Data Science"),
    (r"biotech", "Biotechnology", "Biotechnology"),
    (r"business|management|commerce|\bmba\b|finance|economics", "Business and Management", "Business"),
)


def normalise_field(field: str | None) -> tuple[str | None, str | None]:
    """Returns (canonical label, phrase used in search filters)."""
    if not field:
        return None, None
    low = field.lower()
    for pattern, label, phrase in FIELD_RULES:
        if re.search(pattern, low):
            return label, phrase
    cleaned = re.sub(r"\s+", " ", field).strip()
    return cleaned, cleaned


# ------------------------------------------------------------------ degrees

BACHELOR_RE = re.compile(r"\b(b\.?\s?tech|b\.?\s?e\b|bachelor|b\.?\s?sc|bsc|b\.?\s?s\b|undergrad|b\.?\s?eng|beng|b\.?\s?ca|bca|b\.?\s?com)", re.I)
MASTER_RE = re.compile(r"\b(m\.?\s?tech|m\.?\s?s\b|master|msc|m\.?\s?sc|m\.?\s?eng|meng|m\.?\s?e\b|mca|m\.?\s?a\b)", re.I)
MBA_RE = re.compile(r"\b(mba|m\.b\.a|pgdm|post ?graduate diploma in management|master of business)", re.I)
PHD_RE = re.compile(r"\b(ph\.?\s?d|doctor of philosophy|doctorate|dphil)", re.I)
SCHOOLING_RE = re.compile(r"\b(high school|higher secondary|secondary|class xii|class x|12th|10th|cbse|icse|hsc|ssc|intermediate)\b", re.I)


def degree_level(degree: str | None) -> str | None:
    if not degree:
        return None
    if PHD_RE.search(degree):
        return "PhD"
    if MBA_RE.search(degree):
        return "MBA"
    if MASTER_RE.search(degree):
        return "Master's"
    if BACHELOR_RE.search(degree):
        return "Bachelor's"
    if SCHOOLING_RE.search(degree):
        return "School"
    return None


# ------------------------------------------------------------------ titles

INTERN_RE = re.compile(r"\b(intern|internship|interns|working student|werkstudent(in)?|praktikant(in)?|co-?op student|summer analyst)\b", re.I)
STUDENT_RE = re.compile(r"\b(student|graduate research assistant|teaching assistant|research assistant)\b", re.I)

TITLE_FAMILIES: tuple[tuple[str, str], ...] = (
    (r"machine learning|\bml\b|\bmlops\b|deep learning|\bai engineer|applied scientist", "Machine Learning Engineer"),
    (r"data engineer|etl|big data|analytics engineer|data platform", "Data Engineer"),
    (r"data scien", "Data Scientist"),
    (r"data analy|business intelligence|\bbi\b|analytics analyst|insights analyst", "Data Analyst"),
    (r"business analy", "Business Analyst"),
    (r"product manager|product owner", "Product Manager"),
    (r"devops|site reliability|\bsre\b|cloud engineer|platform engineer|infrastructure engineer", "DevOps / Cloud Engineer"),
    (r"security", "Security Engineer"),
    (r"front ?end|frontend|ui developer|react developer", "Frontend Engineer"),
    (r"back ?end|backend|java developer|python developer|golang", "Backend Engineer"),
    (r"full ?stack", "Full-Stack Engineer"),
    (r"\bqa\b|quality assurance|test engineer|sdet|tester", "QA / Test Engineer"),
    (r"embedded|firmware|vlsi|hardware", "Embedded / Hardware Engineer"),
    (r"software|developer|programmer|\bsde\b|engineer,? software|application engineer|systems engineer|member of technical staff", "Software Engineer"),
    (r"consultant", "Consultant"),
    (r"research(er| scientist| engineer| fellow)", "Researcher"),
    (r"professor|lecturer|faculty", "Academic"),
    (r"manager|head of|director|lead", "Manager / Lead"),
    (r"analyst", "Analyst"),
    (r"design", "Designer"),
    (r"mechanical|automotive|process engineer|production engineer|manufacturing", "Mechanical / Manufacturing Engineer"),
    (r"engineer", "Engineer (other)"),
    (r"founder|owner", "Founder"),
)

SENIORITY_WORDS = re.compile(
    r"\b(senior|sr\.?|junior|jr\.?|lead|principal|staff|associate|trainee|graduate|entry[- ]level|i{1,3}|iv|[1-4])\b", re.I
)


def title_family(title: str | None) -> str | None:
    if not title:
        return None
    t = title.lower()
    if INTERN_RE.search(t):
        return "Intern / Working Student"
    for pattern, label in TITLE_FAMILIES:
        if re.search(pattern, t):
            return label
    cleaned = SENIORITY_WORDS.sub("", title)
    cleaned = re.sub(r"[^\w\s/&+-]", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned.title() if cleaned else None


def is_intern_title(title: str | None) -> bool:
    return bool(title and INTERN_RE.search(title))


def role_keywords(role: str) -> list[str]:
    """Core words of a role phrase, for matching titles loosely."""
    stop = {"senior", "junior", "lead", "the", "a", "an", "of", "and", "in", "at", "for", "sr", "jr"}
    return [w for w in re.findall(r"[a-zA-Z+#]+", role.lower()) if w not in stop and len(w) > 1]


def title_matches_role(title: str | None, role: str | None) -> bool:
    if not title or not role:
        return False
    fam_t = title_family(title)
    fam_r = title_family(role)
    if fam_t and fam_r and fam_t == fam_r and fam_r not in ("Engineer (other)", "Manager / Lead", "Analyst"):
        return True
    words = role_keywords(role)
    low = title.lower()
    return bool(words) and all(re.search(rf"\b{re.escape(w)}", low) for w in words)


SENIORITY_ORDER = [
    "Internship / working student",
    "Entry level",
    "Mid level (not stated)",
    "Senior",
    "Lead / principal",
    "Manager and above",
]


def seniority_from_title(title: str | None) -> str:
    t = (title or "").lower()
    if INTERN_RE.search(t):
        return "Internship / working student"
    if re.search(r"\b(head of|director|vp|vice president|chief|manager)\b", t):
        return "Manager and above"
    if re.search(r"\b(lead|principal|staff|architect)\b", t):
        return "Lead / principal"
    if re.search(r"\b(senior|sr\.?)\b", t):
        return "Senior"
    if re.search(r"\b(junior|jr\.?|graduate|entry|trainee|associate)\b", t):
        return "Entry level"
    return "Mid level (not stated)"


SENIORITY_LEVEL_RANK = {
    "In Training": 0,
    "Entry Level": 1,
    "Senior": 2,
    "Entry Level Manager": 3,
    "Experienced Manager": 4,
    "Strategic": 4,
    "Director": 5,
    "Vice President": 6,
    "Owner / Partner": 6,
    "CXO": 7,
}

NON_TRAINING_LEVELS = [k for k in SENIORITY_LEVEL_RANK if k != "In Training"]

# ------------------------------------------------------------------ skills

SKILLS: tuple[tuple[str, str], ...] = (
    ("Python", r"\bpython\b"),
    ("SQL", r"\bsql\b"),
    ("Java", r"\bjava\b(?!script)"),
    ("Scala", r"\bscala\b"),
    ("Go", r"\bgolang\b|\bgo\b(?= developer| programming| language)"),
    ("JavaScript", r"\bjavascript\b"),
    ("TypeScript", r"\btypescript\b"),
    ("C++", r"c\+\+"),
    ("C#", r"c#|\.net\b"),
    ("R", r"\br\b(?= programming| language|,| and python)"),
    ("Spark", r"\b(apache )?spark\b|pyspark"),
    ("Kafka", r"\bkafka\b"),
    ("Airflow", r"\bairflow\b"),
    ("dbt", r"\bdbt\b"),
    ("Snowflake", r"\bsnowflake\b"),
    ("Databricks", r"\bdatabricks\b"),
    ("BigQuery", r"\bbigquery\b"),
    ("Redshift", r"\bredshift\b"),
    ("Hadoop", r"\bhadoop\b"),
    ("AWS", r"\baws\b|amazon web services"),
    ("Azure", r"\bazure\b"),
    ("GCP", r"\bgcp\b|google cloud"),
    ("Docker", r"\bdocker\b"),
    ("Kubernetes", r"\bkubernetes\b|\bk8s\b"),
    ("Terraform", r"\bterraform\b"),
    ("CI/CD", r"ci/cd|continuous integration"),
    ("Git", r"\bgit\b"),
    ("Linux", r"\blinux\b"),
    ("PostgreSQL", r"postgres"),
    ("MongoDB", r"mongodb"),
    ("NoSQL", r"\bnosql\b"),
    ("ETL", r"\betl\b|\belt\b"),
    ("Data modelling", r"data model"),
    ("Machine learning", r"machine learning|\bml\b"),
    ("Deep learning", r"deep learning"),
    ("PyTorch", r"pytorch"),
    ("TensorFlow", r"tensorflow"),
    ("scikit-learn", r"scikit|sklearn"),
    ("NLP", r"\bnlp\b|natural language"),
    ("LLMs", r"\bllms?\b|large language model|generative ai|genai"),
    ("Statistics", r"statistic"),
    ("Tableau", r"\btableau\b"),
    ("Power BI", r"power ?bi"),
    ("Excel", r"\bexcel\b"),
    ("React", r"\breact\b"),
    ("Node.js", r"node\.?js"),
    ("Spring", r"\bspring( boot)?\b"),
    ("Microservices", r"microservice"),
    ("REST APIs", r"\brest(ful)?\b|\bapis?\b"),
    ("Agile", r"\bagile\b|\bscrum\b"),
    ("SAP", r"\bsap\b"),
)
_SKILL_RES = [(name, re.compile(pat, re.I)) for name, pat in SKILLS]


def skills_in_text(text: str | None) -> set[str]:
    if not text:
        return set()
    return {name for name, rx in _SKILL_RES if rx.search(text)}


def normalise_skill(skill: str) -> str:
    for name, rx in _SKILL_RES:
        if rx.search(skill):
            return name
    return skill.strip()


# ------------------------------------------------------------------ languages & visa

LANGUAGES = ("German", "Dutch", "French", "Swedish", "Danish", "Norwegian", "Finnish", "Spanish", "Italian", "Polish", "Japanese")
_LANG_NATIVE = {
    "German": r"german|deutsch",
    "Dutch": r"dutch|nederlands",
    "French": r"french|français|francais",
    "Swedish": r"swedish|svenska",
    "Danish": r"danish",
    "Norwegian": r"norwegian",
    "Finnish": r"finnish",
    "Spanish": r"spanish|español",
    "Italian": r"italian",
    "Polish": r"polish",
    "Japanese": r"japanese",
}
_REQ_BEFORE = r"(fluent|fluency|business[- ]fluent|native|proficien\w*|excellent|very good|good|strong|working|professional|solid|c1|c2|b2|mandatory|required)"
_REQ_AFTER = r"(required|mandatory|is a must|must|essential|c1|c2|b2|fluency|fluent|skills are required|is required)"
_PLUS = r"(plus|nice to have|nice-to-have|advantage|advantageous|bonus|preferred|desirable|beneficial|helpful)"

_GERMAN_TEXT = re.compile(r"\b(und|wir|sie|die|der|das|mit|für|ihre|deine|du|bei|eine|unser|aufgaben|kenntnisse)\b", re.I)
_DUTCH_TEXT = re.compile(r"\b(en|wij|jij|je|het|een|voor|met|bij|ons|werkzaamheden|kennis|functie)\b", re.I)


def language_requirement(text: str | None) -> tuple[str, str | None]:
    """Classify a posting: ('required'|'plus'|'written_in'|'english_only', language)."""
    if not text:
        return "english_only", None
    low = text.lower()
    words = re.findall(r"[a-zäöüß]+", low)
    if len(words) >= 40:
        ger = len(_GERMAN_TEXT.findall(low)) / len(words)
        dut = len(_DUTCH_TEXT.findall(low)) / len(words)
        if ger > 0.08:
            return "written_in", "German"
        if dut > 0.10:
            return "written_in", "Dutch"
    best_plus = None
    for lang in LANGUAGES:
        name = _LANG_NATIVE[lang]
        if not re.search(rf"\b({name})\b", low):
            continue
        sentences = re.split(r"(?<=[.!?\n;])", low)
        for s in sentences:
            if not re.search(rf"\b({name})\b", s):
                continue
            if re.search(_PLUS, s):
                best_plus = best_plus or lang
                continue
            if re.search(rf"{_REQ_BEFORE}[^.\n]{{0,40}}\b({name})\b", s) or re.search(rf"\b({name})\b[^.\n]{{0,40}}{_REQ_AFTER}", s):
                return "required", lang
    if best_plus:
        return "plus", best_plus
    return "english_only", None


_VISA_NEG = re.compile(
    r"(unable|not able|cannot|can't|can not|do not|don't|does not|doesn't|won't|will not|are not able|no)\s+(to\s+)?(offer|provide|support|sponsor)\w*\s*(any\s+)?(visa|work permit|sponsorship)?"
    r"|without (the need for )?(visa )?sponsorship|must (already )?(have|hold) (the |a )?(valid )?(right to work|work permit|eu work)"
    r"|no (visa )?sponsorship",
    re.I,
)
_VISA_POS = re.compile(
    r"visa sponsorship|sponsor(ship)? (for )?(your |a |the )?(work )?visa|we (will |can )?sponsor|blue card|relocation (support|package|assistance)|work permit support|visa support",
    re.I,
)


def visa_signal(text: str | None) -> str:
    """'offers' | 'rules_out' | 'silent'."""
    if not text:
        return "silent"
    if _VISA_NEG.search(text):
        return "rules_out"
    if _VISA_POS.search(text):
        return "offers"
    return "silent"


# ------------------------------------------------------------------ role phrases for title filters

ROLE_SYNONYMS: dict[str, list[str]] = {
    "Machine Learning Engineer": ["Machine Learning Engineer", "ML Engineer", "AI Engineer"],
    "Data Engineer": ["Data Engineer", "Big Data Engineer", "Analytics Engineer"],
    "Data Scientist": ["Data Scientist"],
    "Data Analyst": ["Data Analyst", "Business Intelligence Analyst", "BI Analyst"],
    "Software Engineer": ["Software Engineer", "Software Developer", "Software Development Engineer"],
    "Backend Engineer": ["Backend Engineer", "Backend Developer", "Back End Developer"],
    "Frontend Engineer": ["Frontend Engineer", "Frontend Developer", "Front End Developer"],
    "Full-Stack Engineer": ["Full Stack Developer", "Full Stack Engineer", "Fullstack Developer"],
    "DevOps / Cloud Engineer": ["DevOps Engineer", "Cloud Engineer", "Site Reliability Engineer", "Platform Engineer"],
    "Product Manager": ["Product Manager", "Product Owner"],
    "Business Analyst": ["Business Analyst"],
    "QA / Test Engineer": ["QA Engineer", "Test Engineer", "Quality Assurance Engineer"],
    "Security Engineer": ["Security Engineer", "Security Analyst"],
}


def role_phrases(role: str) -> list[str]:
    """The user's role wording plus standard synonyms of its family (max 4 phrases)."""
    role = re.sub(r"\s+", " ", role or "").strip()
    if not role:
        return []
    out = [role]
    fam = title_family(role)
    if fam in ROLE_SYNONYMS:
        out += ROLE_SYNONYMS[fam]
    seen: list[str] = []
    for p in out:
        if p.lower() not in [s.lower() for s in seen]:
            seen.append(p)
    return seen[:4]


def display_role(role: str) -> str:
    fam = title_family(role)
    if fam in ROLE_SYNONYMS:
        return fam
    return role.strip()
