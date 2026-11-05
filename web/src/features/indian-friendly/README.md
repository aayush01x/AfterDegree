# Indian-friendly employers (tool 7)
Ranked employer table, one square per Indian-educated person seen (solid = started in the last 24 months, hollow = earlier).
Fixed columns: share senior or above, median stay, and factual visa-signal badges (never promises). Rows under 5 fold into "Other".
Filters: role and city (client-side, over cells `roles`/`cities`); country comes from the run. `config.ts` is the form, `mock.ts` has `mockResult` (Germany) and `mockResultThin` (Eindhoven, with NL register badges).
`View.tsx` falls back to the shared `ResultView` when there is no ranked table, and renders any extra sections with `SectionView`.
Numbers are lower bounds ("at least k of n"); aggregates only, no individual is shown.
