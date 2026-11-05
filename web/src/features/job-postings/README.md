Job posting analysis: for a role and place, what the last 90 days of postings show.
Signature visual is the headline `GridNumber` of open postings with its change on the previous 90 days, then `StackedCells` (postings by month as stacked cell columns).
`CellSplit` draws the language split and visa-sponsorship share as one 40-cell bar; `EmployersTable` shows hire-through as High, Some or Unclear (never an accusation).
Skills and seniority use the shared `SectionView`; any other section kind falls back to it too.
`mock.ts` exports `mockResult` (412 postings, Data Engineer in Berlin) and `mockResultThin` (9 postings); both are labelled as examples.
