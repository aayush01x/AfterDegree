"""Mock mode: a deterministic, synthetic Crustdata backend.

`FakeCrustdata` holds generated people, job postings and companies in Crustdata's response
shapes and answers /person/search, /job/search, /person/enrich, autocomplete, /company/identify,
/company/enrich and /web/search/live by interpreting the same filter trees the engine sends.
It powers AFTERDEGREE_MOCK=1 (no network) and the test suite. All data is fictional.
"""

from __future__ import annotations

import json
import random
import re
from collections import Counter
from datetime import date, timedelta
from typing import Any

import httpx

REF = date(2026, 11, 1)

# ------------------------------------------------------------------ static vocabularies

COMPANIES: list[dict[str, Any]] = [
    # India
    {"id": 1001, "name": "Infosys", "domain": "infosys.com", "hq": "India", "size": "10001+", "cities": ["Bengaluru", "Pune", "Mysuru"]},
    {"id": 1002, "name": "Tata Consultancy Services", "domain": "tcs.com", "hq": "India", "size": "10001+", "cities": ["Chennai", "Pune", "Mumbai"]},
    {"id": 1003, "name": "Wipro", "domain": "wipro.com", "hq": "India", "size": "10001+", "cities": ["Bengaluru", "Hyderabad"]},
    {"id": 1004, "name": "Accenture", "domain": "accenture.com", "hq": "Ireland", "size": "10001+", "cities": ["Bengaluru", "Hyderabad", "Pune"]},
    {"id": 1005, "name": "Cognizant", "domain": "cognizant.com", "hq": "United States", "size": "10001+", "cities": ["Chennai", "Hyderabad"]},
    {"id": 1006, "name": "Flipkart", "domain": "flipkart.com", "hq": "India", "size": "10001+", "cities": ["Bengaluru"]},
    {"id": 1008, "name": "Zoho", "domain": "zoho.com", "hq": "India", "size": "10001+", "cities": ["Chennai"]},
    {"id": 1009, "name": "Swiggy", "domain": "swiggy.in", "hq": "India", "size": "5001-10000", "cities": ["Bengaluru"]},
    # Global
    {"id": 1007, "name": "Amazon", "domain": "amazon.com", "hq": "United States", "size": "10001+", "cities": ["Bengaluru", "Hyderabad", "Berlin", "Dublin", "London", "Seattle"]},
    {"id": 6001, "name": "Microsoft", "domain": "microsoft.com", "hq": "United States", "size": "10001+", "cities": ["Hyderabad", "Dublin", "Seattle", "Munich"]},
    {"id": 6002, "name": "Google", "domain": "google.com", "hq": "United States", "size": "10001+", "cities": ["Bengaluru", "Munich", "Zurich", "London", "Dublin"]},
    # Germany
    {"id": 2001, "name": "SAP", "domain": "sap.com", "hq": "Germany", "size": "10001+", "cities": ["Berlin", "Munich", "Bengaluru"]},
    {"id": 2002, "name": "Siemens", "domain": "siemens.com", "hq": "Germany", "size": "10001+", "cities": ["Munich", "Berlin"]},
    {"id": 2003, "name": "Zalando", "domain": "zalando.com", "hq": "Germany", "size": "10001+", "cities": ["Berlin"]},
    {"id": 2004, "name": "BMW Group", "domain": "bmwgroup.com", "hq": "Germany", "size": "10001+", "cities": ["Munich"]},
    {"id": 2005, "name": "Bosch", "domain": "bosch.com", "hq": "Germany", "size": "10001+", "cities": ["Stuttgart", "Bengaluru"]},
    {"id": 2006, "name": "Delivery Hero", "domain": "deliveryhero.com", "hq": "Germany", "size": "10001+", "cities": ["Berlin"]},
    {"id": 2007, "name": "N26", "domain": "n26.com", "hq": "Germany", "size": "1001-5000", "cities": ["Berlin"]},
    {"id": 2008, "name": "Celonis", "domain": "celonis.com", "hq": "Germany", "size": "1001-5000", "cities": ["Munich"]},
    {"id": 2009, "name": "Allianz", "domain": "allianz.com", "hq": "Germany", "size": "10001+", "cities": ["Munich", "Frankfurt"]},
    # Netherlands
    {"id": 3001, "name": "Booking.com", "domain": "booking.com", "hq": "Netherlands", "size": "10001+", "cities": ["Amsterdam"]},
    {"id": 3002, "name": "ING", "domain": "ing.com", "hq": "Netherlands", "size": "10001+", "cities": ["Amsterdam"]},
    {"id": 3003, "name": "Adyen", "domain": "adyen.com", "hq": "Netherlands", "size": "1001-5000", "cities": ["Amsterdam"]},
    {"id": 3004, "name": "Philips", "domain": "philips.com", "hq": "Netherlands", "size": "10001+", "cities": ["Eindhoven", "Amsterdam"]},
    {"id": 3005, "name": "ASML", "domain": "asml.com", "hq": "Netherlands", "size": "10001+", "cities": ["Eindhoven"]},
    # UK / Ireland / Canada
    {"id": 4001, "name": "Revolut", "domain": "revolut.com", "hq": "United Kingdom", "size": "5001-10000", "cities": ["London"]},
    {"id": 4002, "name": "Deloitte", "domain": "deloitte.com", "hq": "United Kingdom", "size": "10001+", "cities": ["London", "Manchester", "Hyderabad"]},
    {"id": 4003, "name": "Monzo", "domain": "monzo.com", "hq": "United Kingdom", "size": "1001-5000", "cities": ["London"]},
    {"id": 5001, "name": "Stripe", "domain": "stripe.com", "hq": "United States", "size": "5001-10000", "cities": ["Dublin"]},
    {"id": 7001, "name": "Shopify", "domain": "shopify.com", "hq": "Canada", "size": "10001+", "cities": ["Toronto"]},
]
COMPANY_BY_ID = {c["id"]: c for c in COMPANIES}
CONVERSION = {2001: 0.6, 2002: 0.5, 2003: 0.45, 2004: 0.55, 2005: 0.55, 2006: 0.35, 2007: 0.3, 2008: 0.5, 2009: 0.45,
              3001: 0.55, 3002: 0.5, 3003: 0.35, 3004: 0.45, 3005: 0.6, 4001: 0.3, 4002: 0.5, 4003: 0.3, 5001: 0.4,
              6001: 0.6, 6002: 0.5, 1007: 0.5, 7001: 0.45}

CITY_COUNTRY = {
    "Bengaluru": "India", "Pune": "India", "Mysuru": "India", "Chennai": "India", "Mumbai": "India", "Hyderabad": "India",
    "Berlin": "Germany", "Munich": "Germany", "Stuttgart": "Germany", "Frankfurt": "Germany", "Hamburg": "Germany",
    "Amsterdam": "Netherlands", "Eindhoven": "Netherlands", "Rotterdam": "Netherlands",
    "London": "United Kingdom", "Manchester": "United Kingdom", "Dublin": "Ireland", "Seattle": "United States",
    "Toronto": "Canada", "Zurich": "Switzerland",
}
STATE = {"Bengaluru": "Karnataka", "Mysuru": "Karnataka", "Pune": "Maharashtra", "Mumbai": "Maharashtra", "Chennai": "Tamil Nadu",
         "Hyderabad": "Telangana", "Berlin": "Berlin", "Munich": "Bavaria", "Stuttgart": "Baden-Württemberg", "Frankfurt": "Hesse",
         "Hamburg": "Hamburg", "Amsterdam": "North Holland", "Eindhoven": "North Brabant", "Rotterdam": "South Holland",
         "London": "England", "Manchester": "England", "Dublin": "Leinster", "Seattle": "Washington", "Toronto": "Ontario", "Zurich": "Zurich"}

INDIAN_SCHOOLS = [
    ("Vellore Institute of Technology", "Vellore", 24),
    ("VIT University", "Vellore", 4),
    ("Indian Institute of Technology Bombay", "Mumbai", 5),
    ("Indian Institute of Technology Madras", "Chennai", 5),
    ("National Institute of Technology Tiruchirappalli", "Tiruchirappalli", 7),
    ("National Institute of Technology Karnataka", "Surathkal", 6),
    ("Manipal Institute of Technology", "Manipal", 10),
    ("SRM Institute of Science and Technology", "Chennai", 12),
    ("PES University", "Bengaluru", 6),
    ("Anna University", "Chennai", 9),
    ("Amity University", "Noida", 6),
]
FIELDS = [
    ("Computer Science and Engineering", 45),
    ("Electronics and Communication Engineering", 18),
    ("Information Technology", 12),
    ("Mechanical Engineering", 13),
    ("Electrical and Electronics Engineering", 12),
]
ABROAD_SCHOOLS = {
    "Germany": ["Technical University of Munich", "RWTH Aachen University", "Technische Universität Berlin", "University of Stuttgart"],
    "Netherlands": ["Delft University of Technology", "University of Amsterdam", "Eindhoven University of Technology"],
    "United Kingdom": ["University of Edinburgh", "Imperial College London", "University of Manchester"],
    "Ireland": ["Trinity College Dublin", "University College Dublin"],
    "United States": ["Carnegie Mellon University", "Northeastern University", "Arizona State University"],
    "Canada": ["University of Toronto", "University of Waterloo"],
}
SCHOOL_CITY = {"Technical University of Munich": "Munich", "RWTH Aachen University": "Aachen", "Technische Universität Berlin": "Berlin",
               "University of Stuttgart": "Stuttgart", "Delft University of Technology": "Delft", "University of Amsterdam": "Amsterdam",
               "Eindhoven University of Technology": "Eindhoven", "University of Edinburgh": "Edinburgh", "Imperial College London": "London",
               "University of Manchester": "Manchester", "Trinity College Dublin": "Dublin", "University College Dublin": "Dublin",
               "Carnegie Mellon University": "Pittsburgh", "Northeastern University": "Boston", "Arizona State University": "Tempe",
               "University of Toronto": "Toronto", "University of Waterloo": "Waterloo"}
MASTERS_COUNTRY = [("Germany", 40), ("Netherlands", 14), ("United Kingdom", 15), ("United States", 15), ("Canada", 8), ("Ireland", 8)]
MASTERS_DEGREE = {"Germany": "Master of Science - MS", "Netherlands": "Master of Science - MSc", "United Kingdom": "MSc",
                  "Ireland": "MSc", "United States": "Master of Science - MS", "Canada": "Master of Engineering - MEng"}
MASTERS_FIELD = {"cs": ["Computer Science", "Data Science", "Informatics"], "ece": ["Electrical Engineering", "Embedded Systems", "Computer Science"],
                 "mech": ["Mechanical Engineering", "Automotive Engineering", "Engineering Management"]}

ROLES_BY_FIELD = {
    "cs": ["Software Engineer", "Data Engineer", "Data Scientist", "Backend Developer", "Machine Learning Engineer", "Data Analyst", "Full Stack Developer", "DevOps Engineer"],
    "ece": ["Embedded Software Engineer", "Software Engineer", "Data Engineer", "Data Analyst", "Hardware Engineer"],
    "mech": ["Mechanical Design Engineer", "Data Analyst", "Product Manager", "Manufacturing Engineer", "Consultant"],
}
ROLE_WEIGHTS = {"cs": [25, 22, 12, 12, 10, 10, 5, 4], "ece": [30, 30, 15, 15, 10], "mech": [30, 25, 15, 15, 15]}
INDIA_ENTRY_TITLE = {1001: "Systems Engineer", 1002: "Assistant System Engineer", 1003: "Project Engineer", 1004: "Associate Software Engineer",
                     1005: "Programmer Analyst", 1006: "Software Development Engineer", 1007: "Software Development Engineer", 1008: "Member Technical Staff",
                     1009: "Software Engineer"}
SKILLS_BY_ROLE = {
    "Data Engineer": ["Python", "SQL", "Spark", "Airflow", "Kafka", "AWS", "dbt", "Snowflake", "Docker", "Databricks"],
    "Data Scientist": ["Python", "SQL", "Machine learning", "Statistics", "PyTorch", "scikit-learn", "Spark", "NLP"],
    "Machine Learning Engineer": ["Python", "PyTorch", "TensorFlow", "Docker", "Kubernetes", "AWS", "MLOps", "LLMs"],
    "Software Engineer": ["Java", "Python", "Docker", "Kubernetes", "AWS", "Microservices", "Git", "CI/CD"],
    "Backend Developer": ["Java", "Spring", "PostgreSQL", "Kafka", "Docker", "REST APIs", "Microservices"],
    "Full Stack Developer": ["JavaScript", "TypeScript", "React", "Node.js", "PostgreSQL", "Docker"],
    "DevOps Engineer": ["Kubernetes", "Terraform", "AWS", "Docker", "CI/CD", "Linux", "Python"],
    "Data Analyst": ["SQL", "Python", "Tableau", "Power BI", "Excel", "Statistics"],
    "Embedded Software Engineer": ["C++", "Linux", "Python", "Git"],
    "Hardware Engineer": ["C++", "Linux"],
    "Mechanical Design Engineer": ["Excel", "Agile"],
    "Manufacturing Engineer": ["Excel", "SAP"],
    "Product Manager": ["Agile", "SQL", "Excel"],
    "Consultant": ["Excel", "SQL", "SAP", "Agile"],
}
FIRST = ["Aarav", "Ananya", "Rohan", "Priya", "Karthik", "Sneha", "Arjun", "Divya", "Vikram", "Meera", "Rahul", "Kavya", "Siddharth",
         "Nisha", "Aditya", "Pooja", "Varun", "Isha", "Nikhil", "Shreya", "Harish", "Lakshmi", "Manish", "Tanvi"]
LAST = ["Sharma", "Iyer", "Reddy", "Nair", "Gupta", "Patel", "Menon", "Rao", "Krishnan", "Singh", "Kulkarni", "Joshi", "Pillai",
        "Bose", "Das", "Verma", "Chopra", "Banerjee", "Shetty", "Agarwal"]

JOB_ROLES = ["Data Engineer", "Software Engineer", "Data Scientist", "Machine Learning Engineer", "Backend Developer", "Data Analyst",
             "DevOps Engineer", "Full Stack Developer", "Product Manager", "Embedded Software Engineer"]
JOB_COUNTRY_WEIGHTS = [("Germany", 34), ("Netherlands", 15), ("United Kingdom", 15), ("India", 16), ("Ireland", 6), ("United States", 9), ("Canada", 5)]
JOB_CITIES = {"Germany": ["Berlin", "Munich", "Hamburg", "Frankfurt", "Stuttgart"], "Netherlands": ["Amsterdam", "Rotterdam", "Eindhoven"],
              "United Kingdom": ["London", "Manchester"], "India": ["Bengaluru", "Hyderabad", "Pune", "Chennai"], "Ireland": ["Dublin"],
              "United States": ["Seattle"], "Canada": ["Toronto"]}


def _w(rng: random.Random, pairs):
    items, weights = zip(*pairs)
    return rng.choices(items, weights=weights, k=1)[0]


def _field_key(field: str) -> str:
    low = field.lower()
    if "computer" in low or "information" in low:
        return "cs"
    if "electr" in low:
        return "ece"
    return "mech"


def _dt(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}-01T00:00:00+00:00"


def _add_months(d: date, months: int) -> date:
    m = d.month - 1 + months
    y = d.year + m // 12
    return date(y, m % 12 + 1, 1)


def _companies_in(country: str, exclude_india_only: bool = True) -> list[dict]:
    return [c for c in COMPANIES if any(CITY_COUNTRY.get(ci) == country for ci in c["cities"])]


def _city_for(company: dict, country: str, rng: random.Random) -> str:
    cities = [c for c in company["cities"] if CITY_COUNTRY.get(c) == country]
    return rng.choice(cities) if cities else company["cities"][0]


# ------------------------------------------------------------------ generators


def _role(company: dict, title: str, city: str, start: date, end: date | None, seniority: str, intern: bool = False) -> dict:
    country = CITY_COUNTRY.get(city, company["hq"])
    return {
        "name": company["name"],
        "title": title,
        "crustdata_company_id": company["id"],
        "start_date": _dt(start),
        "end_date": _dt(end) if end else None,
        "seniority_level": seniority,
        "function_category": "Engineering",
        "employment_type": "Internship" if intern else "Full-time",
        "location": f"{city}, {STATE.get(city, city)}, {country}",
        "company_headquarters_country": company["hq"],
        "company_website": f"https://{company['domain']}",
        "is_default": end is None,
    }


def generate_people(n: int = 3000, seed: int = 7) -> list[dict]:
    rng = random.Random(seed)
    people = []
    for i in range(n):
        pid = 500000 + i
        school, school_city, _ = _w(rng, [((s, c, w), w) for s, c, w in INDIAN_SCHOOLS])
        field = _w(rng, FIELDS)
        fk = _field_key(field)
        grad = rng.randint(2014, 2025)
        degree = rng.choice(["Bachelor of Technology - BTech", "B.Tech", "Bachelor of Engineering - BE"])
        schools = [{
            "school": school, "degree": degree, "field_of_study": field, "start_year": grad - 4, "end_year": grad,
            "location": {"city": school_city, "country": "India"} if rng.random() < 0.8 else None,
        }]
        roles: list[dict] = []
        cursor = date(grad, 7, 1)
        path = rng.random()
        role_title = rng.choices(ROLES_BY_FIELD[fk], weights=ROLE_WEIGHTS[fk])[0]
        india_cos = [c for c in COMPANIES if c["id"] < 2000]

        def india_stint(years: float, start: date) -> date:
            co = rng.choice(india_cos)
            end = _add_months(start, max(6, int(years * 12)))
            title = INDIA_ENTRY_TITLE.get(co["id"], "Software Engineer") if fk != "mech" else rng.choice(["Graduate Engineer Trainee", "Design Engineer"])
            roles.append(_role(co, title, _city_for(co, "India", rng), start, None if end >= REF else end, "Entry Level"))
            return end

        if path < 0.38:  # stay in India
            end = india_stint(rng.uniform(1.0, 3.5), cursor)
            while end < REF:
                co = rng.choice(india_cos)
                years = rng.uniform(1.5, 4)
                nxt = _add_months(end, int(years * 12))
                title = ("Senior " if (end.year - grad) >= 4 else "") + role_title
                roles.append(_role(co, title, _city_for(co, "India", rng), end, None if nxt >= REF else nxt, "Senior" if "Senior" in title else "Entry Level"))
                end = nxt
        elif path < 0.80:  # master's abroad
            if rng.random() < 0.6:
                cursor = india_stint(rng.uniform(1.0, 3.0), cursor)
                cursor = _add_months(cursor, 2)
            if cursor >= REF:
                roles[-1]["end_date"] = None
            else:
                mc = _w(rng, MASTERS_COUNTRY)
                ms = rng.choice(ABROAD_SCHOOLS[mc])
                dur = 12 if mc in ("United Kingdom", "Ireland") else 24
                m_start = date(cursor.year if cursor.month <= 9 else cursor.year + 1, 10, 1)
                m_end = _add_months(m_start, dur)
                schools.append({
                    "school": ms, "degree": MASTERS_DEGREE[mc], "field_of_study": rng.choice(MASTERS_FIELD[fk]),
                    "start_year": m_start.year, "end_year": m_end.year,
                    "location": {"city": SCHOOL_CITY.get(ms), "country": mc},
                })
                local = [c for c in _companies_in(mc) if c["id"] >= 1007] or _companies_in(mc)
                intern_co = None
                if rng.random() < 0.6 and m_start < REF:
                    intern_co = rng.choice(local)
                    i_start = _add_months(m_start, rng.randint(6, 12))
                    i_end = _add_months(i_start, rng.randint(6, 12))
                    if i_start < REF:
                        ititle = rng.choice([f"Working Student {role_title}", f"{role_title} Intern", "Werkstudent Software Development",
                                             "Data Engineering Intern"]) if mc == "Germany" else f"{role_title} Intern"
                        roles.append(_role(intern_co, ititle, _city_for(intern_co, mc, rng), i_start, None if i_end >= REF else i_end, "In Training", intern=True))
                        m_end = max(m_end, i_end)
                start = _add_months(m_end, rng.randint(0, 4))
                if start < REF:
                    if intern_co and rng.random() < CONVERSION.get(intern_co["id"], 0.4):
                        co = intern_co
                    elif rng.random() < 0.88:
                        co = rng.choice(local)
                    else:
                        co = rng.choice(india_cos)
                        mc = "India"
                    years = rng.uniform(1.5, 4.5)
                    nxt = _add_months(start, int(years * 12))
                    roles.append(_role(co, role_title, _city_for(co, mc, rng), start, None if nxt >= REF else nxt, "Entry Level"))
                    if nxt < REF:
                        co2 = rng.choice(local) if mc != "India" else rng.choice(india_cos)
                        roles.append(_role(co2, "Senior " + role_title, _city_for(co2, mc, rng), nxt, None, "Senior"))
        elif path < 0.92:  # transfer abroad with work
            end = india_stint(rng.uniform(2.0, 4.0), cursor)
            if end < REF:
                dest = _w(rng, [("Germany", 30), ("United Kingdom", 25), ("Netherlands", 15), ("United States", 15), ("Ireland", 15)])
                movers = [c for c in _companies_in(dest) if c["id"] in (1004, 1007, 6001, 6002, 4002, 2001)] or _companies_in(dest)
                co = rng.choice(movers)
                roles.append(_role(co, role_title, _city_for(co, dest, rng), end, None, "Senior"))
        else:  # MBA or switch
            end = india_stint(rng.uniform(1.5, 3.0), cursor)
            if end < REF:
                schools.append({"school": "Indian Institute of Management Bangalore", "degree": "MBA", "field_of_study": "Business Administration",
                                "start_year": end.year, "end_year": end.year + 2, "location": {"city": "Bengaluru", "country": "India"}})
                start = date(end.year + 2, 6, 1)
                if start < REF:
                    co = rng.choice([c for c in COMPANIES if c["id"] in (1004, 4002, 1006, 1007)])
                    roles.append(_role(co, "Product Manager", _city_for(co, "India", rng), start, None, "Experienced Manager"))

        current = [r for r in roles if r["end_date"] is None]
        past = [r for r in roles if r["end_date"] is not None]
        if current:
            loc_city = current[-1]["location"].split(",")[0]
            loc_country = CITY_COUNTRY.get(loc_city, "India")
        elif len(schools) > 1:
            loc_city = (schools[-1].get("location") or {}).get("city") or "Munich"
            loc_country = (schools[-1].get("location") or {}).get("country") or "Germany"
        else:
            loc_city, loc_country = school_city, "India"
        first, last = rng.choice(FIRST), rng.choice(LAST)
        top_title = (current[-1]["title"] if current else (roles[-1]["title"] if roles else "Student"))
        skills = rng.sample(SKILLS_BY_ROLE.get(role_title, ["Python", "SQL"]), k=min(5, len(SKILLS_BY_ROLE.get(role_title, ["Python", "SQL"]))))
        yexp = 0.0
        for r in roles:
            if r["employment_type"] == "Internship":
                continue
            s = date.fromisoformat(r["start_date"][:10])
            e = date.fromisoformat(r["end_date"][:10]) if r["end_date"] else REF
            yexp += max(0, (e - s).days / 365.25)
        people.append({
            "crustdata_person_id": pid,
            "basic_profile": {
                "name": f"{first} {last}",
                "headline": f"{top_title}",
                "current_title": current[-1]["title"] if current else None,
                "location": {"raw": f"{loc_city}, {STATE.get(loc_city, loc_city)}, {loc_country}", "city": loc_city,
                             "state": STATE.get(loc_city), "country": loc_country, "continent": None},
            },
            "social_handles": {"professional_network_identifier": {"profile_url": f"https://www.linkedin.com/in/fake-person-{pid}"}},
            "experience": {"employment_details": {"current": current, "past": sorted(past, key=lambda r: r["start_date"], reverse=True)}},
            "education": {"schools": schools},
            "skills": {"professional_network_skills": skills},
            "years_of_experience_raw": round(yexp, 1),
            "metadata": {"updated_at": f"2026-10-{(i % 28) + 1:02d}T00:00:00Z"},
        })
    return people


LANG_SENTENCES = {
    "Germany": [("Fluent German (C1) is required for this role.", 0.30), ("German language skills are a plus.", 0.20)],
    "Netherlands": [("Dutch is required at a professional level.", 0.12), ("Dutch is nice to have.", 0.20)],
}
GERMAN_POSTING = ("Wir suchen eine engagierte Person für unser Team. Deine Aufgaben: Du entwickelst und betreibst Datenpipelines mit "
                  "Python und SQL. Du arbeitest mit unseren Teams und bist für die Qualität der Daten verantwortlich. Dein Profil: "
                  "abgeschlossenes Studium der Informatik, sehr gute Deutschkenntnisse und gute Englischkenntnisse. Wir bieten dir "
                  "flexible Arbeitszeiten, ein modernes Büro und eine offene Kultur, in der die Weiterbildung für uns wichtig ist. "
                  "Bewirb dich jetzt mit deinem Lebenslauf und wir melden uns bei dir.")


def generate_jobs(n: int = 6000, seed: int = 11) -> list[dict]:
    rng = random.Random(seed)
    jobs = []
    for i in range(n):
        country = _w(rng, JOB_COUNTRY_WEIGHTS)
        city = rng.choice(JOB_CITIES[country])
        cos = _companies_in(country) or COMPANIES
        co = rng.choice(cos)
        base = rng.choice(JOB_ROLES)
        prefix = rng.choices(["", "Senior ", "Junior ", "Lead ", "", "Working Student "], weights=[45, 25, 10, 7, 8, 5])[0]
        if prefix == "Working Student " and country != "Germany":
            prefix = ""
        title = prefix + base
        age = int(abs(rng.triangular(0, 430, 0)))
        added = REF - timedelta(days=age)
        skills = rng.sample(SKILLS_BY_ROLE.get(base, ["Python", "SQL"]), k=min(4, len(SKILLS_BY_ROLE.get(base, ["Python", "SQL"]))))
        parts = [f"{co['name']} is hiring a {title} in {city}.",
                 f"You will build and run systems using {', '.join(skills)}.",
                 "You collaborate with product and engineering teams."]
        if country == "Germany" and rng.random() < 0.08:
            desc = GERMAN_POSTING
        else:
            for sentence, prob in LANG_SENTENCES.get(country, []):
                if rng.random() < prob:
                    parts.append(sentence)
                    break
            r = rng.random()
            if country in ("Germany", "Netherlands", "Ireland") and r < 0.18 or country in ("United Kingdom", "Canada") and r < 0.12:
                parts.append("We offer visa sponsorship and relocation support.")
            elif r > 0.93:
                parts.append("Unfortunately we are unable to offer visa sponsorship for this role.")
            desc = " ".join(parts)
        jobs.append({
            "crustdata_job_id": 9000000 + i,
            "job_details": {"job_id": 9000000 + i, "title": title, "category": "Engineering", "workplace_type": rng.choice(["Hybrid", "On-site", "Remote", ""]),
                            "source": "professional_network", "employment_type": "intern" if "Working Student" in title else None,
                            "url": f"https://jobs.example.com/{9000000 + i}", "reposted_job": False, "number_of_openings": 1},
            "company": {"basic_info": {"crustdata_company_id": co["id"], "name": co["name"], "primary_domain": co["domain"],
                                       "website": f"https://{co['domain']}", "professional_network_id": str(co["id"] * 7),
                                       "industries": ["Technology, Information and Internet"]},
                        "headcount": {"total": 1000, "range": co["size"], "largest_headcount_country": None}},
            "location": {"raw": f"{city}, {STATE.get(city, city)}, {country}", "city": city, "district": None, "state": STATE.get(city), "country": country, "pincode": None},
            "content": {"description": desc},
            "metadata": {"date_added": added.isoformat() + "T09:00:00", "date_updated": added.isoformat() + "T09:00:00"},
        })
    return jobs


def riya_person_data() -> dict:
    """The mock persona: Riya Menon, BTech CSE VIT Vellore 2022, ~2 years at Infosys (joined Sept 2024 after the onboarding wait),
    aiming for an MS + data role in Germany."""
    return {
        "crustdata_person_id": 4242,
        "basic_profile": {
            "name": "Riya Menon",
            "headline": "Systems Engineer at Infosys | Python, SQL, Spark | Aspiring Data Engineer",
            "current_title": "Systems Engineer",
            "location": {"raw": "Bengaluru, Karnataka, India", "city": "Bengaluru", "state": "Karnataka", "country": "India", "continent": "Asia"},
            "languages": ["English", "Malayalam", "Hindi"],
        },
        "social_handles": {"professional_network_identifier": {"profile_url": "https://www.linkedin.com/in/riya-menon-example"}},
        "experience": {"employment_details": {
            "current": [{"name": "Infosys", "title": "Systems Engineer", "crustdata_company_id": 1001, "start_date": "2024-09-01T00:00:00+00:00",
                         "end_date": None, "seniority_level": "Entry Level", "function_category": "Engineering", "employment_type": "Full-time",
                         "location": "Bengaluru, Karnataka, India", "company_headquarters_country": "India", "is_default": True}],
            "past": [{"name": "Zoho", "title": "Software Engineering Intern", "crustdata_company_id": 1008, "start_date": "2021-05-01T00:00:00+00:00",
                      "end_date": "2021-07-01T00:00:00+00:00", "seniority_level": "In Training", "function_category": "Engineering",
                      "employment_type": "Internship", "location": "Chennai, Tamil Nadu, India", "company_headquarters_country": "India"}],
        }},
        "education": {"schools": [
            {"school": "Vellore Institute of Technology", "degree": "Bachelor of Technology - BTech", "field_of_study": "Computer Science and Engineering",
             "start_year": 2018, "end_year": 2022, "location": {"city": "Vellore", "country": "India"}},
            {"school": "Kendriya Vidyalaya", "degree": "Higher Secondary (Class XII)", "field_of_study": "Science", "start_year": 2016, "end_year": 2018},
        ]},
        "skills": {"professional_network_skills": ["Python", "SQL", "Java", "Apache Spark", "Git", "Linux"]},
    }


# ------------------------------------------------------------------ filter interpreter

_ALIASES = {"company_name": "name", "company_id": "crustdata_company_id", "company_website_domain": "company_website"}


def _path_get(obj: Any, path: str) -> Any:
    cur = obj
    for part in path.split("."):
        if not isinstance(cur, dict):
            return None
        cur = cur.get(part)
    return cur


def _resolve(record: dict, field: str, kind: str) -> tuple[str | None, list[Any]]:
    """Returns (nested_array_key or None, values). For nested arrays, values are elements' sub-values."""
    if kind == "person":
        for prefix, getter in (
            ("experience.employment_details.current.", lambda r: _path_get(r, "experience.employment_details.current") or []),
            ("experience.employment_details.past.", lambda r: _path_get(r, "experience.employment_details.past") or []),
            ("experience.employment_details.", lambda r: (_path_get(r, "experience.employment_details.current") or [])
             + (_path_get(r, "experience.employment_details.past") or [])),
            ("education.schools.", lambda r: _path_get(r, "education.schools") or []),
        ):
            if field.startswith(prefix):
                sub = field[len(prefix):]
                sub = _ALIASES.get(sub, sub)
                return prefix, [(_path_get(e, sub) if not (sub == "company_website" and e.get(sub)) else re.sub(r"^https?://(www\.)?", "", e[sub]).split("/")[0])
                                for e in getter(record)]
        if field == "basic_profile.location.country":
            return None, [_path_get(record, field)]
        if field == "years_of_experience_raw":
            return None, [record.get("years_of_experience_raw")]
        return None, [_path_get(record, field)]
    if field == "company.basic_info.company_id":
        field = "company.basic_info.crustdata_company_id"
    if field == "location" or field == "location.raw":
        field = "location.raw"
    return None, [_path_get(record, field)]


def _cmp_val(v: Any) -> Any:
    if isinstance(v, str) and re.match(r"^\d{4}-\d{2}-\d{2}", v):
        return v[:10]
    return v


def _leaf_value_match(value: Any, op: str, target: Any) -> bool:
    if isinstance(value, list):
        return any(_leaf_value_match(v, op, target) for v in value)
    if op == "is_null":
        return value is None or value == ""
    if op == "is_not_null":
        return value is not None and value != ""
    if value is None:
        return False
    if op in ("=", "!="):
        eq = str(value).lower() == str(target).lower() if isinstance(value, str) or isinstance(target, str) else value == target
        return eq if op == "=" else not eq
    if op in ("in", "not_in"):
        inside = any(str(value).lower() == str(t).lower() for t in target)
        return inside if op == "in" else not inside
    if op == "(.)":
        low = str(value).lower()
        return all(w in low for w in str(target).lower().split())
    if op == "[.]":
        return re.search(rf"(?<![a-z0-9]){re.escape(str(target).lower())}(?![a-z0-9])", str(value).lower()) is not None
    if op == "(!)":
        return str(target).lower() not in str(value).lower()
    if op in ("<", "=<", ">", "=>"):
        a, b = _cmp_val(value), _cmp_val(target)
        try:
            if isinstance(a, str) or isinstance(b, str):
                a, b = str(a), str(b)
            return {"<": a < b, "=<": a <= b, ">": a > b, "=>": a >= b}[op]
        except TypeError:
            return False
    raise ValueError(f"unsupported operator {op}")


NEGATIVE = {"!=": "=", "not_in": "in", "(!)": "[.]"}


def _leaf(record: dict, node: dict, kind: str, element: tuple[str, dict] | None = None) -> bool:
    field, op, target = node["field"], node["type"], node.get("value")
    if element is not None:
        prefix, el = element
        if field.startswith(prefix) or (prefix == "experience.employment_details." and field.startswith("experience.employment_details.")):
            sub = field[len(prefix):] if field.startswith(prefix) else field.split(".", 2)[-1]
            sub = _ALIASES.get(sub, sub)
            return _leaf_value_match(_path_get(el, sub), op, target)
    nested, values = _resolve(record, field, kind)
    if nested is None:
        return _leaf_value_match(values[0], op, target)
    if op in NEGATIVE:
        return not any(_leaf_value_match(v, NEGATIVE[op], target if op != "(!)" else target) for v in values if v is not None)
    if op == "is_null":
        return not any(v not in (None, "") for v in values)
    return any(_leaf_value_match(v, op, target) for v in values)


def _leaf_prefixes(node: dict) -> set[str | None]:
    if "field" in node:
        f = node["field"]
        for p in ("experience.employment_details.current.", "experience.employment_details.past.", "experience.employment_details.", "education.schools."):
            if f.startswith(p):
                return {p}
        return {None}
    if node.get("op") == "all_of":
        return {None}
    out: set[str | None] = set()
    for c in node.get("conditions") or []:
        out |= _leaf_prefixes(c)
    return out


def _elements(record: dict, prefix: str) -> list[dict]:
    if prefix == "education.schools.":
        return _path_get(record, "education.schools") or []
    cur = _path_get(record, "experience.employment_details.current") or []
    past = _path_get(record, "experience.employment_details.past") or []
    if prefix.endswith("current."):
        return cur
    if prefix.endswith("past."):
        return past
    return cur + past


def matches(record: dict, node: dict | None, kind: str, element: tuple[str, dict] | None = None) -> bool:
    if not node:
        return True
    if "field" in node:
        return _leaf(record, node, kind, element)
    op = node.get("op")
    conds = node.get("conditions") or []
    if op == "all_of":
        return all(matches(record, c, kind) for c in conds)
    if element is None and kind == "person":
        prefixes = _leaf_prefixes(node)
        if len(prefixes) == 1 and None not in prefixes:
            prefix = next(iter(prefixes))
            return any(matches(record, node, kind, (prefix, el)) for el in _elements(record, prefix))  # type: ignore[arg-type]
    if op == "and":
        return all(matches(record, c, kind, element) for c in conds)
    if op == "or":
        return any(matches(record, c, kind, element) for c in conds)
    raise ValueError(f"unsupported group op {op}")


def project(record: dict, fields: list[str] | None, always: str) -> dict:
    if not fields:
        return record
    out: dict[str, Any] = {always: record.get(always)}
    for f in fields:
        value = _path_get(record, f)
        if value is None:
            continue
        cur = out
        parts = f.split(".")
        for part in parts[:-1]:
            cur = cur.setdefault(part, {})
        cur[parts[-1]] = value
    return out


# ------------------------------------------------------------------ the fake API


class FakeCrustdata:
    def __init__(self, people: list[dict] | None = None, jobs: list[dict] | None = None, enrich: dict | None = None):
        self.people = people if people is not None else generate_people()
        self.jobs = jobs if jobs is not None else generate_jobs()
        self.enrich_person = enrich if enrich is not None else riya_person_data()
        self.calls: list[tuple[str, dict]] = []

    # -- dispatch

    def handle(self, path: str, body: dict) -> tuple[int, Any]:
        self.calls.append((path, body))
        try:
            if path == "/person/search":
                return 200, self.person_search(body)
            if path == "/job/search":
                return 200, self.job_search(body)
            if path == "/person/enrich":
                return 200, self.person_enrich(body)
            if path == "/person/search/autocomplete":
                return 200, self.autocomplete(body)
            if path == "/company/search/autocomplete":
                return 200, {"suggestions": [{"value": c["name"]} for c in COMPANIES if body.get("query", "").lower() in c["name"].lower()][: body.get("limit", 10)]}
            if path == "/company/identify":
                return 200, self.company_identify(body)
            if path == "/company/enrich":
                return 200, self.company_enrich(body)
            if path == "/web/search/live":
                return 200, self.web_search(body)
        except ValueError as exc:
            return 400, {"error": {"type": "invalid_request", "message": str(exc), "metadata": []}}
        return 403, {"error": {"type": "permission_error", "message": "Endpoint not enabled", "metadata": []}}

    def transport(self) -> httpx.MockTransport:
        def _handler(request: httpx.Request) -> httpx.Response:
            body = json.loads(request.content or b"{}")
            status, payload = self.handle(request.url.path, body)
            return httpx.Response(status, json=payload)

        return httpx.MockTransport(_handler)

    # -- endpoints

    @staticmethod
    def _page(rows: list, body: dict) -> tuple[list, str | None]:
        limit = int(body.get("limit", body.get("count", 20)))
        offset = int(body.get("cursor") or 0)
        page = rows[offset: offset + limit]
        nxt = str(offset + limit) if offset + limit < len(rows) and limit > 0 else None
        return page, nxt

    def person_search(self, body: dict) -> dict:
        found = [p for p in self.people if matches(p, body.get("filters"), "person")]
        found.sort(key=lambda p: p["crustdata_person_id"])
        page, nxt = self._page(found, body)
        return {"profiles": [project(p, body.get("fields"), "crustdata_person_id") for p in page], "next_cursor": nxt,
                "total_count": len(found), "total_count_relation": "eq", "remarks": []}

    def job_search(self, body: dict) -> dict:
        found = [j for j in self.jobs if matches(j, body.get("filters"), "job")]
        found.sort(key=lambda j: j["metadata"]["date_added"], reverse=True)
        page, nxt = self._page(found, body)
        aggs = []
        for agg in body.get("aggregations") or []:
            if agg["type"] == "count":
                aggs.append({"type": "count", "field": None, "value": len(found)})
            elif agg["type"] == "group_by":
                field = agg["field"]
                path = "company.basic_info.crustdata_company_id" if field == "company.basic_info.company_id" else field
                counts = Counter(_path_get(j, path) for j in found if _path_get(j, path) is not None)
                buckets = []
                for key, cnt in counts.most_common(int(agg.get("size", 100))):
                    meta: dict[str, Any] = {}
                    if path.endswith("crustdata_company_id"):
                        c = COMPANY_BY_ID.get(key, {})
                        meta = {"company_name": c.get("name"), "company_website_domain": c.get("domain"), "linkedin_id": str(key * 7)}
                    buckets.append({"key": key, "count": cnt, "metadata": meta})
                aggs.append({"type": "group_by", "field": field, "buckets": buckets})
        return {"job_listings": [project(j, body.get("fields"), "crustdata_job_id") for j in page], "next_cursor": nxt,
                "total_count": len(found), "aggregations": aggs}

    def person_enrich(self, body: dict) -> list:
        out = []
        for url in body.get("professional_network_profile_urls") or []:
            if "not-found" in url:
                out.append({"matched_on": url, "match_type": "professional_network_profile_url", "match_status": "not_found", "matches": []})
                continue
            data = project(self.enrich_person, body.get("fields"), "crustdata_person_id")
            out.append({"matched_on": url, "match_type": "professional_network_profile_url", "match_status": "matched",
                        "matches": [{"confidence_score": 1.0, "person_data": data}]})
        return out

    def autocomplete(self, body: dict) -> dict:
        field, query, limit = body.get("field", ""), (body.get("query") or "").lower(), int(body.get("limit", 20))
        counts: Counter = Counter()
        for p in self.people:
            nested, values = _resolve(p, field, "person")
            for v in values:
                if isinstance(v, str) and query in v.lower():
                    counts[v] += 1
        return {"suggestions": [{"value": v} for v, _ in counts.most_common(limit)]}

    def company_identify(self, body: dict) -> list:
        out = []
        for name in body.get("names") or []:
            low = name.lower()
            ms = []
            for c in COMPANIES:
                if c["name"].lower() == low or low in c["name"].lower():
                    ms.append({"confidence_score": 1.0 if c["name"].lower() == low else 0.8,
                               "company_data": {"crustdata_company_id": c["id"], "basic_info": {
                                   "crustdata_company_id": c["id"], "name": c["name"], "primary_domain": c["domain"],
                                   "employee_count_range": c["size"], "industries": ["Technology, Information and Internet"]}}})
            out.append({"matched_on": name, "match_type": "name", "matches": ms})
        return out

    def company_enrich(self, body: dict) -> list:
        out = []
        for cid in body.get("crustdata_company_ids") or []:
            c = COMPANY_BY_ID.get(cid)
            if not c:
                out.append({"matched_on": str(cid), "match_type": "crustdata_company_id", "matches": []})
                continue
            out.append({"matched_on": str(cid), "match_type": "crustdata_company_id", "matches": [{"confidence_score": 1.0, "company_data": {
                "crustdata_company_id": cid, "basic_info": {"name": c["name"], "primary_domain": c["domain"], "employee_count_range": c["size"]},
                "headcount": {"total": 5000 + cid, "growth_percent": {"mom": 0.4, "qoq": 1.2, "six_months": 2.5, "yoy": 4.1, "two_years": 9.0}}}}]})
        return out

    def web_search(self, body: dict) -> dict:
        q = body.get("query", "")
        m = re.search(r'"([^"]+)"', q)
        name = m.group(1) if m else q
        results = []
        if sum(ord(ch) for ch in name) % 2 == 0:
            results.append({"source": "web", "title": f"Register of licensed sponsors: workers — {name}", "url": "https://www.example.gov/sponsors",
                            "snippet": f"{name} appears in the published list of licensed sponsors.", "position": 1})
        results.append({"source": "web", "title": f"{name} careers", "url": "https://careers.example.com", "snippet": "Join our team.", "position": len(results) + 1})
        return {"success": True, "query": q, "timestamp": 1762400000000, "results": results,
                "metadata": {"total_results": len(results), "failed_pages": [], "empty_pages": []}}


_fake_singleton: FakeCrustdata | None = None


def get_fake() -> FakeCrustdata:
    global _fake_singleton
    if _fake_singleton is None:
        _fake_singleton = FakeCrustdata()
    return _fake_singleton
