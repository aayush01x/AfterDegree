# Market saturation (tool 8)
Signature: two cell stacks side by side (new entrants like you, last 12 months, against open postings, last 90 days annualised) and the ratio as a grid-built numeral (1.2 is two numerals around one square dot) with a low/medium/high label in mentor voice.
Then a quarterly entrants-vs-openings timeseries, the plain-English reading, and a ranked table of comparable cities (the target city inverted, via the shared RankedTable `you` row).
Thin data (under 10 entrants or openings) drops the label to "Too early to say". `levelFor` in `config.ts` holds the 0.8 / 1.5 thresholds.
`mock.ts` has `mockResult` (Data Engineer, Berlin, ratio 1.2) and `mockResultThin` (Leipzig). Unknown sections render through the shared `SectionView`; no stat section falls back to `ResultView`.
