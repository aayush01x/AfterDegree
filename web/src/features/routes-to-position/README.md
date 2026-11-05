Routes to Positions: for one role (and optional company, city, country) shows where people in that position came from.
`FlowGraph` is the signature visual: feeder employers, previous titles and the position on the 32px grid, joined by orthogonal lines; click a block to follow its lines.
Ranked tables (employers, titles, schools) use the shared `SectionView`; `CellColumns` draws years of experience as one cell per person.
`mock.ts` has `mockResult` (268 people, Data Engineer in Berlin) and `mockResultThin` (7 people); both are contract-valid and labelled as examples.
Counts are people we can see, never shares for groups under 10; unknown section kinds fall back to the shared `SectionView`.
