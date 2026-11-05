from afterdegree import taxonomy as tx


def test_language_requirement_detection():
    assert tx.language_requirement("Fluent German (C1) is required for this role.") == ("required", "German")
    assert tx.language_requirement("German language skills are a plus.") == ("plus", "German")
    assert tx.language_requirement("Dutch is required at a professional level.") == ("required", "Dutch")
    assert tx.language_requirement("We build data pipelines in Python.") == ("english_only", None)
    german = ("Wir suchen eine engagierte Person für unser Team. Deine Aufgaben: Du entwickelst und betreibst Datenpipelines "
              "mit Python und SQL. Du arbeitest mit unseren Teams und bist für die Qualität der Daten verantwortlich. Dein Profil: "
              "abgeschlossenes Studium der Informatik und sehr gute Deutschkenntnisse. Wir bieten dir flexible Arbeitszeiten und eine "
              "offene Kultur, in der die Weiterbildung für uns wichtig ist.")
    assert tx.language_requirement(german) == ("written_in", "German")


def test_visa_signal():
    assert tx.visa_signal("We offer visa sponsorship and relocation support.") == "offers"
    assert tx.visa_signal("Unfortunately we are unable to offer visa sponsorship for this role.") == "rules_out"
    assert tx.visa_signal("You must already have the right to work in the UK.") == "rules_out"
    assert tx.visa_signal("Great team, Python, SQL.") == "silent"


def test_title_family_and_seniority():
    assert tx.title_family("Senior Data Engineer") == "Data Engineer"
    assert tx.title_family("Werkstudent Software Development") == "Intern / Working Student"
    assert tx.title_family("ML Engineer II") == "Machine Learning Engineer"
    assert tx.seniority_from_title("Lead Backend Developer") == "Lead / principal"
    assert tx.seniority_from_title("Junior Data Analyst") == "Entry level"
    assert tx.seniority_from_title("Internal Auditor") != "Internship / working student"


def test_role_phrases_and_matching():
    assert tx.role_phrases("ML engineer")[:2] == ["ML engineer", "Machine Learning Engineer"]
    assert tx.title_matches_role("Senior Machine Learning Engineer", "ML engineer")
    assert not tx.title_matches_role("Data Analyst", "Data Engineer")


def test_places_and_schools():
    assert tx.canonical_country("usa") == "United States"
    assert tx.country_variants("US") == ["United States", "United States of America"]
    assert tx.country_for_city("München") == "Germany"
    assert tx.city_variants("Bangalore") == ["Bengaluru", "Bangalore"]
    assert tx.country_from_location_text("Munich, Bavaria, Germany") == "Germany"
    assert tx.school_tier("Vellore Institute of Technology").key == "private_t1"
    assert tx.school_tier("IIT Bombay").key == "iit"
    assert tx.normalise_field("Computer Science and Engineering") == ("Computer Science", "Computer Science")
    assert tx.degree_level("Bachelor of Technology - BTech") == "Bachelor's"
    assert tx.degree_level("Master of Science - MS") == "Master's"
    assert tx.degree_level("Higher Secondary (Class XII)") == "School"
