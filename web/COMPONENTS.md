# AfterDegree web: shared components

Everything below is built from the tokens in `src/app/globals.css` (`--ad-*`, `--font-display`, `--font-ui`). Use tokens, never raw colours. Square corners, 1px rules, no shadows or gradients. Crouwel blue (`--ad-blue`) only for evidence keys and focus, and only on white. The one diagonal is the `<Slash />` mark inside primary buttons and the active nav item.

Types come from `@/lib/types` (contract mirror). Section `data` shapes are typed there per kind (`DistributionData`, `RankedTableData`, `RoutesData`, `RouteListData`, `TimeseriesData`, `StatData`, `TextData`, `KeywordsData`). `makeCount(k, n)` in `@/lib/count` builds a contract `Count` (Wilson CI, `n < 10` rules).

## Feature modules (tool screens)

`src/features/<slug>/index.ts` may export (all optional, see `src/features/types.ts`):

| Export | Type | Used for |
|---|---|---|
| `config` | `FeatureConfig { fields?, defaults?, runLabel?, autoRun? }` | form fields (dotted names nest: `scope.school`), defaults |
| `mockResult` | `ResultEnvelope \| (ctx: MockContext) => ResultEnvelope` | mock mode result for this tool (preferred over `src/mocks/results.ts`) |
| `mockResultThin` | same as `mockResult` | thin-cohort variant. Mock mode serves it when the run is narrow (`exp_band` upper bound <= 1 year) or the page URL has `?thin=1` |
| `View` | `ComponentType<{ result: ResultEnvelope }>` | tool-specific result view; falls back to `<ResultView />` |
| `toParams(values)` / `toBody(values)` | `(Record<string,string>) => object` | convert the flat string form values (dotted names stay flat) to the contract body, e.g. people-like-me turns `exp_band` "1,3" into `[1, 3]`. `ToolScreen` calls it before the request (falls back to `config.toParams`, then to nested strings) |

The route `src/app/(app)/tools/<slug>/` renders `<ToolScreen slug feature />`, which renders `<ToolLayout>` with the feature's config, View and form. Do not edit route files; export from your feature folder instead.

## Tool frame

### `ToolLayout` from `@/components/tool/ToolLayout`
```ts
{
  tool: string;                 // slug, e.g. "job-postings"
  title?: string;               // default from lib/tools.ts
  purpose?: string;             // one line; university lens copy used automatically
  form?: ReactNode;             // inputs with `name` attributes; rendered inside ToolLayout's <form>
  fields?: ToolField[];         // used when `form` is absent: generic <ToolFields />
  defaults?: Record<string,string>;
  buildParams?: (fd: FormData) => Record<string, unknown>; // default: dotted names → nested body
  toParams?: (values: Record<string,string>) => object;    // feature's toParams/toBody; used when buildParams is absent
  resultView?: (result: ResultEnvelope) => ReactNode;      // default: <ResultView result />
  runLabel?: string;            // default "Run"
  autoRun?: boolean;            // default true: runs on arrival when required fields are filled
}
```
ToolLayout owns the job: it starts `POST /api/tools/<slug>` with `profile_id` (+ `institution`/`programs` for university users), polls the job, shows `<JobProgress>`, errors (`<InlineError>` with retry) and the result. URL query params (`?country=Germany`, `?scope.school=VIT`) prefill fields, then stored goals, then `defaults`. ToolLayout watches the query string: when it changes (a View navigates with `toolHref(...)`), the form is re-prefilled and the job re-runs automatically if the required fields are filled.

Mock mode only: `?demo=riya` or `?demo=anjali` on any route seeds that mock profile (student / university) so a screen can be opened directly.

### `ToolFields` from `@/components/tool/ToolFields`
`{ fields: ToolField[]; values: Record<string,string>; errors?: Record<string,string> }`: renders `<Input>`/`<Select>` per field in a responsive row.

### `useJob()` from `@/hooks/useJob`
`{ phase, job, result, error, run(tool: ToolId, profileId, params), reset() }`. Polls `GET /api/jobs/{id}` every 600ms.

### `useProfile()` from `@/components/shell/ProfileContext`
`{ profileId, profile: StoredProfile | null, goals: Goals | null, university: boolean, loading, error, refresh() }`. Available inside the app shell.

## Result rendering (1:1 with section kinds)

| Component | Import | Props |
|---|---|---|
| `ResultView` | `@/components/data/ResultView` | `{ result: ResultEnvelope; only?: string[]; skip?: string[]; hideHeader?: boolean; hideNextSteps?: boolean }` renders summary, cohort, warnings, every section, coverage footer and next steps |
| `SectionView` | `@/components/data/ResultView` | `{ section: Section; evidence?: Evidence[]; result?: ResultEnvelope }` one section in a Panel, dispatched by `kind` |
| `Panel` | `@/components/data/Panel` | `{ title: ReactNode; evidence?: ReactNode; caption?: ReactNode; as?: "section"\|"div"\|"article"; headingLevel?: 2\|3; actions?: ReactNode; className?; children }` white, 1px rule |
| `EvidenceKey` | `@/components/data/EvidenceKey` | `{ n?: number; coverage?: number \| null; date?: string; label?: string; evidence?: Evidence[]; note?: string }` blue key; click opens the evidence drawer |
| `CountDisplay` | `@/components/data/CountDisplay` | `{ count: Count; size?: "sm"\|"md"\|"lg"; showShare?: boolean }` "at least 24 of 37" with interval tooltip |
| `RankedTable` | `@/components/data/RankedTable` | `{ data: RankedTableData; caption?: string; sortable?: boolean; maxRows?: number }` fixed columns, inline cell bars, sortable headers, `you` row inverted |
| `Distribution` | `@/components/data/Distribution` | `{ data: DistributionData; maxRows?: number }` labelled cell bars; `target` inverted; `remainder` hollow |
| `CohortWaffle` | `@/components/data/CohortWaffle` | `{ items: DistributionItem[]; n: number; unit?: string; selected?: string; onSelect?(label); maxCells?: number (600); legend?: boolean; label: string }` one cell per person |
| `KeywordList` | `@/components/data/KeywordList` | `{ data: KeywordsData }` term + count + share; `you_have` filled marker |
| `Timeseries` | `@/components/data/Timeseries` | `{ data: TimeseriesData; height?: number }` SVG line(s) + hidden data table |
| `RouteList` | `@/components/data/RouteList` | `{ data: RouteListData }` ordered paths with counts, years, fit, gaps |
| `RoutesGraph` | `@/components/data/RoutesGraph` | `{ data: RoutesData }` layered step graph with counts; list fallback on phones |
| `Stat` | `@/components/data/Stat` | `{ data: StatData; variant?: "default"\|"hero" }` hero uses `GridNumber` |
| `TextBlock` | `@/components/data/TextBlock` | `{ data: TextData }` |
| `GridNumber` | `@/components/data/GridNumber` | `{ value: number; cell?: number (32); gap?: number (3); tone?: "ink"\|"paper"\|"orange"; label?: string; className? }` integer built from 5x7 cells; rebuilds cell by cell on change |
| `GridFill` | `@/components/data/GridFill` | `{ done: number; total: number; cells?: number; label?: string }` loading grid filling with progress |
| `JobProgress` | `@/components/data/JobProgress` | `{ phase: JobPhase; job: Job \| null; title?: string }` grid fill + current step; `role="status"` |

## Controls

| Component | Import | Props |
|---|---|---|
| `Button` | `@/components/ui/Button` | `{ variant?: "primary"\|"secondary"\|"ghost"; size?: "md"\|"sm"; slash?: boolean; loading?: boolean } & ButtonHTMLAttributes` primary is black with the slash |
| `ButtonLink` | `@/components/ui/Button` | same visual props + `href` (Next `Link`) |
| `Slash` | `@/components/ui/Slash` | `{ className? }` the diagonal mark |
| `Input` | `@/components/ui/Input` | `{ label: string; hint?: string; error?: string } & InputHTMLAttributes` |
| `Select` | `@/components/ui/Select` | `{ label: string; hint?: string; error?: string; options: {value,label}[] } & SelectHTMLAttributes` |
| `Tabs` | `@/components/ui/Tabs` | `{ label: string; tabs: { id: string; label: string; content: ReactNode }[]; defaultTab?: string }` ARIA tabs, arrow keys |
| `Chip` | `@/components/ui/Chip` | `{ children; onRemove?(); removeLabel?: string; selected?: boolean; onClick?() }` |
| `InlineError` | `@/components/ui/InlineError` | `{ title?: string; message: string; hint?: string; onRetry?(); retryLabel?: string }` |
| `ToastProvider`, `useToast` | `@/components/ui/Toast` | `useToast().show(message, tone?: "info"\|"error")` |
| `ExampleBadge` | `@/components/ui/ExampleBadge` | `{ children? }` "Example data" label shown in mock mode |

## Layout rules

- Panels sit on the orange field. Nothing sits on orange except ink text, white panels and black controls.
- Spacing steps are 8px (`--ad-space-1..8`); panel padding is 24px; gaps between panels 24 or 32px.
- Numbers: `font-variant-numeric: tabular-nums` is inherited from `body`.
- Selection inverts (black band, white text); nothing else moves.
- Respect `prefers-reduced-motion` (handled globally for animations).
