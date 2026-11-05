# AfterDegree web: shared components

Everything below is built from the tokens in `src/app/palettes.css` (colour, one block per palette) and `src/app/globals.css` (geometry, type, motion). **Never write a colour literal** in a component, CSS module or art: use a token. Square corners, 1px rules, no shadows or gradients. The evidence key colour (`--ad-key`) is only for evidence keys and focus, and only on paper. The one diagonal is the `<Slash />` mark: inside **primary** buttons and the **active nav item** only (not secondary buttons, not tabs).

Types come from `@/lib/types` (contract mirror) and `@/lib/drill-types` (drill token, PersonCard). Section `data` shapes are typed there per kind. `makeCount(k, n)` in `@/lib/count` builds a contract `Count`.

## Palette (swap = one line)

`<html data-palette={PALETTE}>` is set in `src/app/layout.tsx` from the `PALETTE` constant at the top of that file (`"signal"` today). `palettes.css` holds one block per palette: `:root, [data-palette="signal"] { … }`; a new palette is a pure token block `[data-palette="paper-clay"] { … }` that redefines the same names. Nothing else changes.

| Group | Tokens |
|---|---|
| Surfaces | `--ad-field` (page field behind the work; `--ad-orange` is a legacy alias), `--ad-grid-line` (32px construction grid stroke), `--ad-paper` (panels/tiles), `--ad-ink` (type, rules, primary buttons), `--ad-rule` (1px structural rule), `--ad-rule-soft` (hairline inside paper), `--ad-muted` (secondary text on paper), `--ad-hollow` (remainder-cell outline), `--ad-on-field` / `--ad-on-field-muted` (text directly on the field) |
| Rail | `--ad-rail`, `--ad-rail-text`, `--ad-rail-muted`, `--ad-rail-rule`, `--ad-rail-hover`, `--ad-rail-active` (active nav background), `--ad-rail-active-ink` |
| Dark band | `--ad-band` (full-bleed row background), `--ad-band-text`, `--ad-band-muted`, `--ad-band-rule`, `--ad-band-control` |
| Accent | `--ad-accent` (drill buttons on dark, markers), `--ad-accent-ink` (text on accent), `--ad-accent-soft` (tinted chip/tag ground) |
| Evidence + focus | `--ad-key` (evidence key, N/coverage/date; legacy alias `--ad-blue`), `--ad-focus-paper`, `--ad-dot` (offset-dot texture) |
| States | `--ad-error`, `--ad-error-paper`, `--ad-ok`, `--ad-warn` |
| Art: detail cells | `--art-ink` (silhouette cells), `--art-light` (pale cells, windows), `--art-sun`, `--art-tint` (pale blue detail), `--art-deep` (dark detail), `--art-water`, `--art-glow` (warm detail, e.g. TV-tower band) |
| Art: places | `--art-de`, `--art-us`, `--art-uk`, `--art-ca`, `--art-nl`, `--art-in`, `--art-other` (country/destination fields; cities inherit their country, other cities use `--art-1..8`) |
| Art: hues | `--art-1` … `--art-8` (company-mark fields and generic city fields) and `--art-1-on` … `--art-8-on` (motif colour on that field) |
| Routes | `--route-1` … `--route-4` (route-art fields), `--route-path`, `--route-node` |
| Career stages | `--stage-study`, `--stage-work-in` (work in home country), `--stage-masters` (master's abroad), `--stage-intern` (intern / working student), `--stage-fulltime` (full-time abroad), `--stage-gap` (no role listed) |
| Destination strip | `--dest-1` … `--dest-7` (one-cell-per-person strip groups, in rank order; the remainder group is drawn hollow in `--dest-rest`) |

Texture helpers (globals.css): `.ad-dots` paints the offset-dot texture (loading / empty / "too few people"), `.ad-grid-field` paints field + grid.

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

All data components are **drillable**: any `distribution.items[]`, `ranked_table.rows[]`, `route_list.routes[]`, `routes.nodes[]` that carries the engine's `drill` token (`DrillToken`, `@/lib/drill-types`) becomes a button that calls `useDrill().open(token, label)`. Clickable things invert on hover/focus and are keyboard operable (Enter/Space). Without a token they render as plain text. Nothing to wire in views.

| Component | Import | Props |
|---|---|---|
| `ResultView` | `@/components/data/ResultView` | `{ result: ResultEnvelope; only?: string[]; skip?: string[]; hideHeader?: boolean; hideNextSteps?: boolean }` |
| `SectionView` | `@/components/data/ResultView` | `{ section: Section; evidence?: Evidence[]; result?: ResultEnvelope }` one section in a Panel, dispatched by `kind` |
| `Panel` | `@/components/data/Panel` | `{ title: ReactNode; evidence?: ReactNode; caption?: ReactNode; as?: "section"\|"div"\|"article"; headingLevel?: 2\|3; actions?: ReactNode; example?: boolean (inline "Example data" chip after the title); className?; children }` paper, 1px rule, edges on the 32px grid |
| `EvidenceKey` | `@/components/data/EvidenceKey` | `{ n?; coverage?; date?; label?; evidence?; note?; tone?: "key"\|"ink"; boxed? }` |
| `CountDisplay` | `@/components/data/CountDisplay` | `{ count: Count; size?: "sm"\|"md"\|"lg"; showShare?: boolean }` |
| `RankedTable` | `@/components/data/RankedTable` | `{ data: RankedTableData; caption?: string; sortable?: boolean; maxRows?: number; selectedId?: string; onSelect?(row) }` plain tabular figures; `you`/selected row inverts edge to edge incl. the label cell; rows with `drill` are buttons |
| `Distribution` | `@/components/data/Distribution` | `{ data: DistributionData; maxRows?: number; compact?: boolean }` items with `drill` are buttons |
| `CohortWaffle` | `@/components/data/CohortWaffle` | `{ items: DistributionItem[]; n: number; unit?; selected?; onSelect?(label); maxCells?; legend?; label: string; filledLabel?; hollowLabel? }` groups with `drill` open it (or `onSelect`) |
| `PersonStrip` | `@/components/data/PersonStrip` | `{ items: DistributionItem[]; n: number; label: string; intro?: ReactNode; keyLabel?: ReactNode; cell?: number (12) }` the home "one cell per person" strip: reflows rows by width, groups coloured `--dest-1..7`, remainder hollow, target group inverted, groups with `drill` clickable |
| `KeywordList` | `@/components/data/KeywordList` | `{ data: KeywordsData }` |
| `Timeseries` | `@/components/data/Timeseries` | `{ data: TimeseriesData; height?: number }` |
| `RouteList` | `@/components/data/RouteList` | `{ data: RouteListData }` routes with `drill` are buttons |
| `RoutesGraph` | `@/components/data/RoutesGraph` | `{ data: RoutesData }` nodes with `drill` are buttons |
| `Stat` | `@/components/data/Stat` | `{ data: StatData; variant?: "default"\|"hero" }` |
| `TextBlock` | `@/components/data/TextBlock` | `{ data: TextData }` |
| `CellDigits` | `@/components/data/CellDigits` | `{ value: number\|string; pitch?: number (2); font?: "5x7"\|"3x5"; tone?: "ink"\|"paper"\|"accent"\|"muted"\|"current"; gap?: number; label?: string; assemble?: boolean; className? }` cell-built digits. **Only for headline numbers and tile counts**; tables, badges, chips and keys use plain tabular Archivo figures. Tile counts: `pitch` 3–5; the home hero uses `GridNumber` (pitch 32) |
| `GridNumber` | `@/components/data/GridNumber` | `{ value: number; cell?: number (32); gap?: number (1); tone?: "ink"\|"paper"\|"accent"; label?; className? }` monumental headline number on the 32px grid; rebuilds cell by cell on change |
| `GridFill` | `@/components/data/GridFill` | `{ done: number; total: number; cells?: number; label?: string }` |
| `JobProgress` | `@/components/data/JobProgress` | `{ phase; job; title?; cells?; size? }` |
| `Drillable` | `@/components/data/Drillable` | `{ token?: DrillToken \| null; label: string; className?; activeClassName?; children; as?: "div"\|"li"\|"tr"\|"span" }` wraps anything: with a token (and a mounted provider) it is a keyboard-operable button-role element that inverts on hover/focus and opens the drill; without one it renders `as` plainly. `drillOf(x: unknown): DrillToken \| undefined` reads `x.drill` safely |
| `EmptyState` | `@/components/data/EmptyState` | `{ title: string; children?: ReactNode; tone?: "paper"\|"field"; actions?: ReactNode; className? }` offset-dot texture box for empty / "too few people" / not-listed states |

## Tiles (`@/components/tiles/*`)

Horizontal poster rows (the approved Streaming Wall blend). Tile edges sit on the 32px grid, gaps are 32px, the last tile is cut by the viewport edge, nothing paints outside its row.

**Bleed:** a `TileRow` pads its heading and tiles by 32px and pulls itself out of its container by `--ad-row-bleed` (default 0). A container with horizontal padding P sets `--ad-row-bleed: P` (e.g. `32px`) on itself, so the dark band and the scroller reach the container's edges. Put rows directly in the page column, not inside a Panel.

| Component | Import | Props |
|---|---|---|
| `TileRow` | `@/components/tiles/TileRow` | `{ title: ReactNode; note?: ReactNode (inline, after the heading); id?: string; band?: boolean (full-bleed dark band); dim?: boolean (dim the art of every tile that is not `expanded`); headingLevel?: 2\|3; label?: string (scroller aria-label; default from title); count?: ReactNode (right of heading, before ‹ ›); example?: boolean (Example data chip after heading); height?: "auto"\|number; className?; children }` heading + inline note + working ‹ › buttons (disabled at the ends), a scroll-snap scroller (arrow keys / Home / End when focused), full-bleed to the right edge |
| `PosterTile` | `@/components/tiles/PosterTile` | `{ title: string; art: ReactNode; count?: number; unit?: string ("people"); badge?: string; variant?: "poster"\|"card"\|"wide"; expanded?: boolean; details?: ReactNode (expanded body slot); countLine?: ReactNode (expanded "at least N of M" line override); drill?: DrillToken\|null; drillLabel?: string ("See the 71 people"); expandedArt?: ReactNode (art used when expanded, e.g. `<PlaceArt shape="wide" />`); href?: string; onSelect?(); note?: string ("Counts only"); tone?: "paper"\|"band"; className? }` poster = tall art (destinations), card = paper card with landscape art (companies, cities), wide = landscape. The whole tile is the drill target when it has `drill`/`href`/`onSelect`; expanded shows the details slot plus a drill button |
| `PersonTile` | `@/components/tiles/PersonTile` | `{ person: PersonCard; expanded?: boolean; from?: number; to?: number; tone?: "paper"\|"band"; onOpen?(id) (default `useDrill().openPerson(id)`); openLabel?: string; className? }` anonymous career card: cell avatar, headline, `since`, year strip of stage-coloured cells, match chips, tags; expanded adds the step list |
| `RouteTile` | `@/components/tiles/RouteTile` | `{ title: string (steps joined with →) ; steps?: string[]; people: number; years?: number\|null; badge?: string; hue?: 1\|2\|3\|4 (route colour); drill?: DrillToken\|null; href?: string; className? }` stepped cell path art + title + cell-digit count |
| `LinkTile` | `@/components/tiles/LinkTile` | `{ question: string; label: string; href: string }` the dotted end-of-row tile pointing to a tool |
| `StageLegend` | `@/components/tiles/StageLegend` | `{ stages?: Stage[]; tone?: "paper"\|"band" }` swatches for the career-stage colours |

## Cell art (`@/components/art/*`)

Flat cells on a field, built from tokens only (`var(--art-*)`), `shape-rendering: crispEdges`, `role="img"` + `aria-label`. Art renders at a native cell pitch and is centred (or bottom-aligned) in a box filled with its field, so a tile can be any width.

| Component | Import | Props |
|---|---|---|
| `PlaceArt` | `@/components/art/PlaceArt` | `{ place: string; shape?: "portrait"\|"landscape"\|"wide"; pitch?: number (8); label?: string; field?: string (CSS colour, default from the place); className? }` Berlin/Germany (TV tower + Brandenburg Gate), US (skyline), UK (Tower Bridge), Canada (mountains), Netherlands (gables), India (dome), Munich (twin towers), Walldorf (campus), Frankfurt (skyline), Hamburg (cranes), Bengaluru (dome + colonnade), any other city (generic skyline), "Other"/"Elsewhere" (globe) |
| `placeField(place)` | `@/components/art/PlaceArt` | `(place: string) => string` the field token for a place, e.g. `"var(--art-de)"` |
| `CompanyMark` | `@/components/art/CompanyMark` | `{ name: string; shape?: "landscape"\|"square"; pitch?: number (8); className? }` deterministic abstract mark from the name (never a real logo): motif + `--art-N` field |
| `RouteArt` | `@/components/art/RouteArt` | `{ steps?: number (3); runs?: number[]; hue?: 1\|2\|3\|4; field?: string; cols?: number (44); rows?: number (12); pitch?: number (8); label?: string; seed?: string }` stepped cell path, node per step |
| `CountryMap` | `@/components/art/CountryMap` | `{ country: string; markers?: { label: string; count: number; selected?: boolean; onSelect?(); listable?: boolean }[]; cell?: number (16); label?: string; className? }` Germany silhouette (cities placed by name), generic cell blob for other countries; markers are buttons when `onSelect` is set |
| `CellAvatar` | `@/components/art/CellAvatar` | `{ seed: string; cells?: number (4); cell?: number (8); inverse?: boolean; className? }` symmetric neutral weave, decorative (`aria-hidden`) |
| `CareerStrip` | `@/components/art/CareerStrip` | `{ steps: PersonStep[]; from?: number; to?: number; cell?: number (16); gap?: number (2); height?: number; years?: "ends"\|"all"\|"none"; tone?: "paper"\|"band"; label?: string }` one cell per year, stage-coloured (`--stage-*`), split cells when a year has two stages |
| `stageOf`, `STAGES` | `@/components/art/stages` | `stageOf(step: PersonStep, homeCountry?: string): Stage`; `STAGES: { id: Stage; label: string; token: string }[]` |
| `DotTexture` | `@/components/art/DotTexture` | `{ className?; children?; as? }` offset-dot texture box (same as the `.ad-dots` class) |

## Controls

| Component | Import | Props |
|---|---|---|
| `Button` | `@/components/ui/Button` | `{ variant?: "primary"\|"secondary"\|"ghost"\|"accent"; size?: "md"\|"sm"\|"lg"; slash?: boolean (default: primary only); chevron?: boolean; loading?: boolean } & ButtonHTMLAttributes` |
| `ButtonLink` | `@/components/ui/Button` | same visual props + `href` (Next `Link`) |
| `Slash` | `@/components/ui/Slash` | `{ className? }` the diagonal mark |
| `Chevron` | `@/components/ui/Chevron` | `{ dir?: "left"\|"right"\|"up"\|"down"; size?: number; className? }` square-cap chevron icon in `currentColor` |
| `Input` | `@/components/ui/Input` | `{ label: string; hint?: string; error?: string } & InputHTMLAttributes` |
| `Select` | `@/components/ui/Select` | `{ label: string; hint?: string; error?: string; options: {value,label}[] } & SelectHTMLAttributes` |
| `Tabs` | `@/components/ui/Tabs` | `{ label: string; tabs: { id: string; label: string; content: ReactNode }[]; defaultTab?: string }` active tab inverted (no slash) |
| `Chip` | `@/components/ui/Chip` | `{ children; onRemove?(); removeLabel?: string; selected?: boolean; onClick?(); tone?: "outline"\|"soft" }` |
| `Tag` | `@/components/ui/Tag` | `{ children; tone?: "ink"\|"accent"\|"soft"\|"paper" }` small solid label ("Your target", "Fits you best", "since 2024") |
| `InlineError` | `@/components/ui/InlineError` | `{ title?: string; message: string; hint?: string; onRetry?(); retryLabel?: string }` |
| `ToastProvider`, `useToast` | `@/components/ui/Toast` | `useToast().show(message, tone?)` |
| `ExampleBadge` | `@/components/ui/ExampleBadge` | `{ children?; inline?: boolean }` "Example data" chip, mock mode only. Place it **inline after a heading**, never as an eyebrow above it |

## Layout rules

- Panels and tiles sit on the field; their edges land on the 32px grid with 32px gutters (`--ad-cell`). Panel padding 24px inside a 32px-aligned box.
- Reading text (body, captions, table cells, chips) is Archivo; Chakra Petch only for headings and numerals. No eyebrow labels above headings.
- Numbers: tabular figures inherited from `body`. Cell-built digits only for headline and tile counts.
- Selection inverts (ink band, paper text) edge to edge; nothing else moves. Hover/focus on a clickable thing inverts it too.
- Loading = grid filling (`GridFill` / `JobProgress`); empty, thin and "too few people" = offset-dot texture (`EmptyState`).
- Respect `prefers-reduced-motion` (handled globally).
