import type { Evidence, Goals, ProfileResponse } from "@/lib/types";

const enrichEvidence = (id: string, url: string): Evidence => ({
  id,
  endpoint: "/person/enrich",
  filters: { linkedin_profile_url: url },
  total_count: 1,
  results_used: 1,
  fetched_at: "2026-11-06T09:41:00Z",
  source: "mock",
  note: "Example profile served in mock mode",
});

/** Student going abroad / early professional. */
export const RIYA: Omit<ProfileResponse, "profile_id"> = {
  person: {
    name: "Riya Menon",
    headline: "Systems Engineer at Infosys · Python, SQL, Spark",
    location: { city: "Bengaluru", country: "India" },
    education: [
      {
        school: "Vellore Institute of Technology, Vellore",
        degree: "BTech",
        field: "Computer Science and Engineering",
        start_year: 2018,
        end_year: 2022,
        school_country: "India",
      },
    ],
    experience: [
      {
        company: "Infosys",
        company_id: 10421,
        title: "Systems Engineer",
        start_date: "2024-07",
        end_date: null,
        seniority: "Entry",
        function: "Engineering",
      },
      {
        company: "Infosys",
        company_id: 10421,
        title: "Systems Engineer Trainee",
        start_date: "2024-03",
        end_date: "2024-06",
        seniority: "Training",
        function: "Engineering",
      },
      {
        company: "Zoho",
        company_id: 22810,
        title: "Data Science Intern",
        start_date: "2021-05",
        end_date: "2021-07",
        seniority: "Intern",
        function: "Data",
      },
    ],
    skills: ["Python", "SQL", "Apache Spark", "Azure Data Factory", "Power BI", "Java", "Git"],
  },
  derived: {
    undergrad_school: "VIT Vellore",
    undergrad_field: "Computer Science and Engineering",
    undergrad_end_year: 2022,
    years_experience: 2.3,
    current_company: "Infosys",
    current_title: "Systems Engineer",
    persona_guess: "student_abroad",
  },
  evidence: [enrichEvidence("ev_enrich_riya", "https://www.linkedin.com/in/riya-menon")],
};

/** University career-office persona. */
export const ANJALI: Omit<ProfileResponse, "profile_id"> = {
  person: {
    name: "Anjali Iyer",
    headline: "Deputy Director, Career Development Centre at VIT",
    location: { city: "Vellore", country: "India" },
    education: [
      {
        school: "University of Madras",
        degree: "MBA",
        field: "Human Resource Management",
        start_year: 2004,
        end_year: 2006,
        school_country: "India",
      },
      {
        school: "Stella Maris College",
        degree: "BCom",
        field: "Commerce",
        start_year: 2001,
        end_year: 2004,
        school_country: "India",
      },
    ],
    experience: [
      {
        company: "Vellore Institute of Technology",
        company_id: 55120,
        title: "Deputy Director, Career Development Centre",
        start_date: "2017-06",
        end_date: null,
        seniority: "Director",
        function: "Education",
      },
      {
        company: "Vellore Institute of Technology",
        company_id: 55120,
        title: "Placement Manager",
        start_date: "2011-07",
        end_date: "2017-05",
        seniority: "Manager",
        function: "Education",
      },
    ],
    skills: ["Career counselling", "Employer relations", "Program review", "Alumni engagement"],
  },
  derived: {
    undergrad_school: "Stella Maris College",
    undergrad_field: "Commerce",
    undergrad_end_year: 2004,
    years_experience: 15.4,
    current_company: "Vellore Institute of Technology",
    current_title: "Deputy Director, Career Development Centre",
    persona_guess: "university",
  },
  evidence: [enrichEvidence("ev_enrich_anjali", "https://www.linkedin.com/in/anjali-iyer-careers")],
};

export const RIYA_GOALS: Goals = {
  persona: "student_abroad",
  intent: "masters_abroad",
  target_roles: ["Data Engineer"],
  target_countries: ["Germany"],
  target_cities: ["Berlin"],
  target_companies: [],
  institution: null,
  programs: [],
  constraints: [],
};

export const ANJALI_GOALS: Goals = {
  persona: "university",
  intent: "program_insights",
  target_roles: [],
  target_countries: [],
  target_cities: [],
  target_companies: [],
  institution: "Vellore Institute of Technology",
  programs: ["BTech Computer Science and Engineering"],
  constraints: [],
};
