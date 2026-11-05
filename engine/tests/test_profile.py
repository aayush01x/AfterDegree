from datetime import date

from afterdegree.mock import riya_person_data
from afterdegree.profile import (
    Role,
    extract_person_data,
    normalise_linkedin_url,
    normalise_profile,
    parse_date,
    parse_person,
    years_of_experience,
)

from .conftest import load_fixture


def test_linkedin_url_validation():
    assert normalise_linkedin_url("linkedin.com/in/riya-menon/") == "https://www.linkedin.com/in/riya-menon"
    assert normalise_linkedin_url("https://in.linkedin.com/in/abc?trk=x") == "https://www.linkedin.com/in/abc"
    assert normalise_linkedin_url("https://www.linkedin.com/company/stripe") is None
    assert normalise_linkedin_url("https://example.com/in/x") is None
    assert normalise_linkedin_url("") is None


def test_parse_date_variants():
    assert parse_date("2017-01-01T00:00:00+00:00") == date(2017, 1, 1)
    assert parse_date("2022-07") == date(2022, 7, 1)
    assert parse_date(2019) == date(2019, 1, 1)
    assert parse_date({"year": 2020, "month": 3}) == date(2020, 3, 1)
    assert parse_date(None) is None and parse_date("soon") is None


def test_normalise_docs_enrich_example():
    pdata = extract_person_data(load_fixture("person_enrich_all_fields.json"))
    person, derived = normalise_profile(pdata, date(2026, 11, 6))
    assert person.name == "David Hsu"
    assert person.location.city == "San Francisco" and person.location.country == "United States"
    assert person.experience[0].company == "Retool" and person.experience[0].company_id == 633593
    assert person.experience[0].start_date == "2017-01" and person.experience[0].end_date is None
    assert person.education[0].field == "Philosophy and Computer Science"
    assert derived.undergrad_school == "University of Oxford"
    assert derived.current_company == "Retool" and derived.current_title == "Founder, CEO"
    assert derived.years_experience == 9.8
    assert derived.persona_guess == "professional"


def test_extract_handles_no_match():
    assert extract_person_data(load_fixture("person_enrich_no_match.json")) is None
    assert extract_person_data([{"match_status": "redacted", "matches": []}]) is None


def test_normalise_riya():
    person, derived = normalise_profile(riya_person_data(), date(2026, 11, 1))
    assert derived.undergrad_school == "Vellore Institute of Technology"
    assert derived.undergrad_field == "Computer Science and Engineering"
    assert derived.undergrad_end_year == 2022
    assert derived.current_company == "Infosys"
    assert 2.0 <= derived.years_experience <= 2.3  # internship excluded
    assert derived.persona_guess == "student_abroad"
    assert person.education[-1].school_country is None or person.education[0].school_country == "India"
    assert "Python" in person.skills


def test_university_persona_guess():
    data = riya_person_data()
    data["experience"]["employment_details"]["current"] = [{
        "name": "Vellore Institute of Technology", "title": "Director, Career Development Centre (placement)",
        "start_date": "2010-01-01T00:00:00+00:00"}]
    _, derived = normalise_profile(data, date(2026, 11, 1))
    assert derived.persona_guess == "university"


def test_parse_search_profile_from_docs():
    raw = load_fixture("person_search_name.json")["profiles"][0]
    p = parse_person(raw)
    assert p.country == "United States"
    assert p.undergrad().school == "IIIT Hyderabad"
    assert p.undergrad().country == "India"
    assert len(p.roles) == 3 and p.primary_current().company == "Crustdata (YC F24)"


def test_years_of_experience_merges_overlaps():
    d = date
    roles = [
        Role("A", 1, "Engineer", d(2020, 1, 1), d(2022, 1, 1), False),
        Role("B", 2, "Engineer", d(2021, 1, 1), d(2023, 1, 1), False),
        Role("C", 3, "Data Intern", d(2019, 1, 1), d(2019, 6, 1), False),
    ]
    assert years_of_experience(roles, d(2026, 1, 1)) == 3.0
