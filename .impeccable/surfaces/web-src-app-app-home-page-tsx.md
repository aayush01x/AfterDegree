---
version: 1
slug: "web-src-app-app-home-page-tsx"
primary_target: "web/src/app/(app)/home/page.tsx"
related_targets: ["web/src/app/onboarding/page.tsx"]
---

# Surface brief: AfterDegree app (onboarding + home + 8 tools)

Scope: the logged-in app shell, first-run onboarding, the "People like you" home, and the eight tool screens. Visitor mode: Operate. Desktop-first web, usable on phones.

Audience and job: students going abroad, working professionals, and university staff; each wants to see where people like them (or their graduates) actually ended up and take one evidence-backed next step. Proof is live Crustdata counts with N, coverage and data date. Constraint: aggregates only, warm-mentor copy, honest lower bounds.

Memorable moment: the cohort drawn as one square cell per real person, with the headline number built from the same grid cells.

## Direction contract

THESIS: Your cohort is the proof, built on a visible grid: one cell per real person like you, and each screen's single answer set monumental in grid-built numerals. It refuses the category default of KPI cards and bar charts floating on a grey page.

OWN-WORLD: Saturated signal-orange field (#FF5A1F) owning the page behind the work, overlaid by a faint 32px construction grid in pale blue; near-black rail and ink (#111111); white work panels with 1px black rules and square corners; one Crouwel blue (#0057FF) reserved for evidence keys (N, coverage, date) and focus, only ever on white. Display type is a square, grid-constructed face with angled cuts; UI and body in a neutral grotesk with tabular figures. The one permitted diagonal: a slash mark inside primary buttons and active nav, nowhere else. No shadows, gradients, rounded corners or side-stripe borders.

STORY: The visitor sees, in one look, how many people with their background did what they hope to do; believes it because every cell is a counted person and every panel states its N, coverage and date; and presses the single next-step button.

FIRST VIEWPORT: Left: black rail (Home, then the eight tools, user chip at the foot). Top of the orange field: greeting, profile line, and a white cohort-definition card at top right. Left column: "At least", the monumental grid-built number, one plain sentence, and the black primary button with its diagonal slash. Right, dominant: a white panel holding the waffle of cohort cells grouped by destination, the target row inverted to black. Below: three white panels (what they do now, employers in the target, further degrees). Footer line on orange: coverage and data date.

FORM: Crouwel gridded type specimen (catalog world crouwel-grid-specimen), the first dealt card of bolder re-roll round 1, position 1 of that hand; seed:02451bceed4c2939.

SIGNATURE INTERACTION AND MOTION: Results assemble cell by cell in reading order on the 32px grid (about 200ms, no overshoot) when a tool finishes; the headline numeral rebuilds cell by cell when its value changes; selecting a row, cell group or nav item inverts it to its negative and nothing else moves. Loading shows the grid filling as job progress advances. Reduced motion: instant states.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Onboarding surface inherits this world: orange field, a white panel for the LinkedIn URL, the user's own profile revealed as cells, then the mentor conversation in a white panel with suggested replies as standard buttons.
- University lens copy ("your graduates") on every tool.
