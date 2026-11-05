# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (TypeScript) web app for the UI; Python FastAPI service for the engine that computes every number. LLM features use OpenRouter with `deepseek/deepseek-v4.1-flash-1017` (configurable via `OPENROUTER_MODEL`). Data comes live from the Crustdata API (cached to disk; each distinct query is paid for once). Desktop-first, responsive down to phones.

## Users

Three audiences, one engine:

1. **Students going abroad**: Indian students and young professionals (typically BTech plus 0 to 4 years of work) deciding on a master's abroad and on the job route after it.
2. **Working professionals**: early and mid-career people planning a move (a new role, a new country, a switch) who want to know which routes actually worked for people like them.
3. **Universities**: program and career-office staff who want to see where their graduates actually work, how interns convert, and how saturated their graduates' target markets are, so they can improve the programs they offer.

## Product Purpose

AfterDegree shows people where others with their exact background actually ended up, and which routes got them there. Every number is computed from real professional-profile and job-posting data (Crustdata), with counts and coverage shown, so advice is grounded in outcomes rather than brochures or agents' commissions.

Success: a user leaves with a concrete, evidence-backed next step (a program, a company, a route, a skill) and understands how sure the evidence is.

## Positioning

The only tool that answers "how did people like me do?" from real career data. Crustdata person search can match several schools and employers in one profile with start and end dates, so AfterDegree can build cohorts of people with your background and follow them forward or backward in time. Rankings, agents and job boards cannot truthfully make this claim.

## Operating Context

- **Onboarding**: the user pastes their LinkedIn profile URL. The only external lookup during onboarding is Crustdata person enrich on that URL (education, work history, skills, location). A short conversational step, run by the LLM, asks a few follow-up questions (goals, target countries or roles, constraints) and lets the user correct what was found. University users are recognised from their current employer being a university; they confirm which institution and programs they represent.
- **The eight capabilities in this version** (definitions are binding for the build):
  1. **People Like Me**: the cohort of people who share the user's background (undergrad school or tier, field, experience band), and where they are now: countries, roles, employers, seniority, and the further degrees they took.
  2. **Internship to Job (Chances)**: for a target company, role or country, how often internships and working-student roles turned into full-time jobs for people like the user, as a chance with its count.
  3. **Conversion Map**: intern-to-job conversion ratios by company (and by school or program), ranked, with counts.
  4. **Reverse Career GPS**: the user names a goal (role, city or country, optionally company); AfterDegree traces how people in that position today got there and lays out the routes that fit the user's starting point, with the gaps to close.
  5. **Routes to Positions**: for a specific position (role at a company or in a city), the aggregate map of entry routes: feeder employers, previous titles, schools and degrees, and typical years of experience.
  6. **Job Posting Analysis**: for a role and location, what current postings show: volume and trend, seniority mix, skills in demand, language requirements (share needing German, Dutch and so on), mentions of visa sponsorship, and whether each employer's postings have historically led to hires (ghost-posting signal).
  7. **Indian-Friendly Companies**: employers abroad with evidence of hiring Indian-educated people (counts, recency, seniority reached, how long they stay), plus signals that they sponsor visas (postings that mention sponsorship and, where public registers exist, sponsor-licence status).
  8. **Market Saturation**: for a field, role and city, new entrants with the user's kind of background versus open postings, and the trend.

## Capabilities and Constraints

- **Code decides, the LLM explains.** All metrics come from deterministic code over Crustdata results. The LLM only interprets free text (goals, titles), runs the onboarding conversation, and writes short summaries from facts it is given.
- **Honest numbers.** Show counts as "at least N of M visible profiles", with coverage and data date. Small cohorts (under 10) are widened with a visible label or marked low confidence; never shown as a confident percentage.
- **Every count is clickable.** Any country, city, company, role, route or employer opens a drill-down: the next-level breakdown, then anonymous career trajectories of the people behind the count, then one person's full career timeline.
- **Anonymous individuals only.** Following Crustdata's data terms (no publishing personal data outside the organisation, no people directories), other people appear only as anonymous career trajectories: no name, photo, profile link or exact dates (years only), and individuals are listed only when at least 5 people match. Only the signed-in user's own profile is shown with their name.
- **Crustdata endpoints available on the key**: person search (30 RPM), person enrich (15 RPM), person and company autocomplete (300 RPM), company identify (30 RPM), company search (30 RPM), company enrich (15 RPM), job search (30 RPM), web search and web fetch (10 RPM). Not available: contact enrich, person identify, live and batch endpoints, watchers.
- **Undecided**: authentication and accounts; sponsor-register coverage beyond the UK and Netherlands; pricing.

## Brand Commitments

- Name: **AfterDegree**.
- Voice: **warm mentor**. Friendly and encouraging, like a senior who has done it, but always citing evidence and honest about uncertainty. Never hype, never shame a university or a user's choices.

## Evidence on Hand

- Live Crustdata data via the team's API key (see `.env`; never committed).
- No testimonials, customers, partner universities, press, or benchmarks exist yet. Do not fabricate any. Example numbers in design mock content must be visibly labelled as examples or replaced by live results.

## Product Principles

1. People like you, not averages: every view starts from the user's own background.
2. Show the evidence and how sure it is: counts, coverage, date, one click from every number.
3. Unknown is not bad: thin data is labelled, never turned into a negative verdict.
4. A next step, not a report: every screen ends with something the user can act on.
5. Serve students, professionals and universities from one engine; show real career paths without identifying anyone.

## Accessibility & Inclusion

Desktop-first, fully usable on phones. WCAG 2.2 AA as the floor. Many users are non-native English readers and many parents read along, so copy stays plain.
