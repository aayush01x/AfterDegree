"use client";

import Form from "next/form";
import { useMemo, useState, type ReactNode } from "react";
import type { Count } from "@/lib/types";
import { drillOf, pressable } from "@/components/tool/drill";
import { CohortCard, HeroNumber, Notes, ResultFoot, SectionHead, ToolHero } from "@/components/tool/ToolHero";
import { useDrill } from "@/components/drill/useDrill";
import { EvidenceKey } from "@/components/data/EvidenceKey";
import { KeywordList } from "@/components/data/KeywordList";
import { Panel } from "@/components/data/Panel";
import { SectionView } from "@/components/data/ResultView";
import { RouteTile } from "@/components/tiles/RouteTile";
import { TileRow } from "@/components/tiles/TileRow";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Tag } from "@/components/ui/Tag";
import { Chevron } from "@/components/ui/Chevron";
import { Input } from "@/components/ui/Input";
import { formatDate, fmtInt, fmtPct } from "@/lib/format";
import { toolHref } from "@/lib/tools";
import type {
  KeywordsData,
  ResultEnvelope,
  RouteListData,
  RouteListItem,
  Section,
  TextData,
} from "@/lib/types";
import { goalText, type GoalParts } from "./config";
import styles from "./View.module.css";

type PartKey = keyof GoalParts;

const PART_LABEL: Record<PartKey, string> = {
  role: "Role",
  city: "City",
  country: "Country",
  company: "Company",
};
const PART_ORDER: PartKey[] = ["role", "city", "country", "company"];
const MAX_ROUTES = 5;

const FIT_LABEL: Record<NonNullable<RouteListItem["fit"]>, string> = {
  fits_you: "Fits you well",
  stretch: "A stretch from today",
  far: "A longer way round",
};
const FIT_RANK = { fits_you: 0, stretch: 1, far: 2 } as const;

/* ---------- reading the result ---------- */

function readGoal(result: ResultEnvelope): GoalParts {
  const g = (result.cohort?.filters as Record<string, unknown> | undefined)?.goal;
  const out: GoalParts = {};
  if (g && typeof g === "object") {
    for (const k of PART_ORDER) {
      const v = (g as Record<string, unknown>)[k];
      if (typeof v === "string" && v.trim()) out[k] = v.trim();
    }
    return out;
  }
  /* Fallback: "Role: X. City: Y. Country: Z." in the parsed-goal text section. */
  const text = result.sections.find((s): s is Extract<Section, { kind: "text" }> => s.kind === "text")?.data.text ?? "";
  for (const k of PART_ORDER) {
    const m = new RegExp(`${PART_LABEL[k]}:\\s*([^.]+?)(?:\\.|$)`, "i").exec(text);
    if (m && !/^any/i.test(m[1])) out[k] = m[1].trim();
  }
  return out;
}

const peopleK = (r: RouteListItem) => (typeof r.people === "number" ? r.people : r.people.k);

function bestRoute(routes: RouteListItem[]): string | null {
  if (routes.length === 0) return null;
  const sorted = [...routes].sort(
    (a, b) =>
      (a.fit ? FIT_RANK[a.fit] : 3) - (b.fit ? FIT_RANK[b.fit] : 3) || peopleK(b) - peopleK(a),
  );
  return sorted[0].id;
}

const yearsText = (y: number) => `${Number.isInteger(y) ? y : y.toFixed(1)} ${y === 1 ? "year" : "years"}`;

/* ---------- goal chips ---------- */

function GoalEditor({ initial, evidence }: { initial: GoalParts; evidence: ReactNode }) {
  const [parts, setParts] = useState<GoalParts>(initial);
  const [editing, setEditing] = useState<PartKey | null>(null);
  const [draft, setDraft] = useState("");
  const dirty = goalText(parts) !== goalText(initial);

  const open = (k: PartKey) => {
    setEditing(k);
    setDraft(parts[k] ?? "");
  };
  const commit = () => {
    if (!editing) return;
    const v = draft.trim();
    setParts((p) => ({ ...p, [editing]: v || undefined }));
    setEditing(null);
  };
  const clear = (k: PartKey) => setParts((p) => ({ ...p, [k]: undefined }));

  return (
    <Panel
      title="Your goal, as we read it"
      evidence={evidence}
      caption="Tap a chip to correct it. We trace the routes again when you press the button."
      as="section"
      className={styles.goalCard}
    >
      <Form action="/tools/career-routes" className={styles.goalForm}>
        <input type="hidden" name="tab" value="path" />
        {PART_ORDER.map((k) => (parts[k] ? <input key={k} type="hidden" name={k} value={parts[k]} /> : null))}
        <ul className={styles.chips} role="list">
          {PART_ORDER.map((k) => {
            const v = parts[k];
            return (
              <li key={k}>
                {v ? (
                  <Chip
                    onClick={() => open(k)}
                    selected={editing === k}
                    onRemove={k === "role" ? undefined : () => clear(k)}
                    removeLabel={`Remove ${PART_LABEL[k].toLowerCase()} ${v}`}
                  >
                    {`${PART_LABEL[k]}: ${v}`}
                  </Chip>
                ) : (
                  <Chip onClick={() => open(k)} selected={editing === k}>
                    {`Add ${PART_LABEL[k].toLowerCase()}`}
                  </Chip>
                )}
              </li>
            );
          })}
        </ul>
        {editing && (
          <div className={styles.edit}>
            <Input
              label={PART_LABEL[editing]}
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit();
                } else if (e.key === "Escape") {
                  setEditing(null);
                }
              }}
              placeholder={editing === "company" ? "Any company" : undefined}
            />
            <Button type="button" variant="secondary" size="sm" onClick={commit} className={styles.set}>
              Set {PART_LABEL[editing].toLowerCase()}
            </Button>
          </div>
        )}
        {dirty && (
          <Button type="submit" disabled={!parts.role}>
            Trace routes for this goal
          </Button>
        )}
      </Form>
    </Panel>
  );
}

/* ---------- a route as a stepped cell path ---------- */

const countText = (people: Count | number) => (typeof people === "number" ? `${fmtInt(people)} people` : people.display);
const shareText = (people: Count | number) => (typeof people === "number" || people.share === null ? null : fmtPct(people.share));

/** One route in detail: the header and path open the people on it; the gaps are a checklist. */
function RouteBlock({ route, rank, best, total }: { route: RouteListItem; rank: number; best: boolean; total: number }) {
  const drill = useDrill();
  const token = drillOf(route) ?? null;
  const [closed, setClosed] = useState<Set<number>>(new Set());
  const toggle = (i: number) =>
    setClosed((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  const last = route.steps.length - 1;
  const people = route.people;
  const share = shareText(people);
  const title = route.title ?? `Route ${rank}`;

  const top = (
    <>
      <header className={styles.routeHead}>
        <div className={styles.routeTitle}>
          <span className={styles.routeNo}>{rank}</span>
          <div>
            <h3>{title}</h3>
            <p className={styles.meta}>
              {best && <Tag tone="ink">Fits you best</Tag>}
              {route.fit && !best && <span>{FIT_LABEL[route.fit]}</span>}
              {route.typical_years != null && <span>Typically {yearsText(route.typical_years)}</span>}
            </p>
          </div>
        </div>
        <p className={styles.people}>
          {countText(people)}
          {share && <span> · {share}</span>}
          {token && (
            <span className={styles.open}>
              See the people <Chevron size={14} />
            </span>
          )}
        </p>
      </header>

      <ol className={styles.path} aria-label="Steps from you to the goal">
        {route.steps.map((s, i) => (
          <li
            key={`${s.label}-${i}`}
            className={[styles.stepWrap, "ad-assemble"].join(" ")}
            style={{ ["--i" as string]: rank * 4 + i, ["--n" as string]: total * 4 }}
          >
            {i > 0 && (
              <span className={styles.trail} aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            )}
            <div className={[styles.step, i === 0 ? styles.you : "", i === last ? styles.goal : ""].join(" ")}>
              <span className={styles.stepLabel}>{s.label}</span>
              {s.years != null && i > 0 && <span className={styles.stepYears}>about {yearsText(s.years)}</span>}
            </div>
          </li>
        ))}
      </ol>
    </>
  );

  return (
    <li className={styles.route}>
      {token ? (
        <div
          className={[styles.hit, styles.top].join(" ")}
          aria-label={`${title}. Open the ${countText(people)} on this route`}
          {...pressable(() => drill.open(token, title))}
        >
          {top}
        </div>
      ) : (
        <div className={styles.top}>{top}</div>
      )}

      <div className={styles.gaps}>
        <h4>
          Gaps to close
          {route.gaps.length > 0 && (
            <span className={styles.progress}>
              {" "}
              ({closed.size} of {route.gaps.length} ticked)
            </span>
          )}
        </h4>
        {route.gaps.length === 0 ? (
          <p className={styles.noGaps}>Nothing stands out. Your profile already matches the usual steps on this route.</p>
        ) : (
          <ul role="list">
            {route.gaps.map((g, i) => (
              <li key={g}>
                <label className={styles.check}>
                  <input type="checkbox" checked={closed.has(i)} onChange={() => toggle(i)} />
                  <span className={styles.box} aria-hidden="true" />
                  <span className={closed.has(i) ? styles.done : undefined}>{g}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

/* ---------- the view ---------- */

export function View({ result }: { result: ResultEnvelope }) {
  const drill = useDrill();
  const routeSection = result.sections.find((s): s is Extract<Section, { kind: "route_list" }> => s.kind === "route_list");
  const kwSection = result.sections.find((s): s is Extract<Section, { kind: "keywords" }> => s.kind === "keywords");
  const goalSection = result.sections.find((s): s is Extract<Section, { kind: "text" }> => s.kind === "text" && s.id === "goal");
  const used = new Set([routeSection?.id, kwSection?.id, goalSection?.id].filter(Boolean) as string[]);
  const others = result.sections.filter((s) => !used.has(s.id));

  const allRoutes = (routeSection?.data as RouteListData | undefined)?.routes ?? [];
  const routes = allRoutes.slice(0, MAX_ROUTES);
  const best = bestRoute(routes);
  const bestItem = routes.find((r) => r.id === best);

  const goal = useMemo(() => readGoal(result), [result]);
  const cohort = result.cohort;
  const realWarnings = result.warnings.filter((w) => !/mock mode/i.test(w));

  const allThin = routes.length > 0 && routes.every((r) => typeof r.people !== "number" && r.people.n < 10);
  const isThin = result.confidence === "low" || Boolean(cohort?.widened) || allThin;
  const widenPart: PartKey | null = goal.city ? "city" : goal.company ? "company" : null;

  const kw = kwSection?.data as KeywordsData | undefined;
  const lacking = kw ? { ...kw, items: kw.items.filter((i) => !i.you_have) } : undefined;
  const have = kw?.items.filter((i) => i.you_have).map((i) => i.term) ?? [];

  const evNode = <EvidenceKey n={cohort?.n_visible} date={formatDate(result.data_date)} evidence={result.evidence} />;

  const bestToken = (bestItem ? drillOf(bestItem) : null) ?? null;
  const bestK = bestItem ? peopleK(bestItem) : 0;
  /* route counts are over the profiles the engine read, not the whole cohort */
  const readN = bestItem && typeof bestItem.people !== "number" ? bestItem.people.n : null;
  const bestTitle = bestItem?.title ?? "the best-fit route";
  const notes = [
    ...(isThin
      ? [
          `Only a few people match this goal, so the routes below can swing a lot. That is not a bad sign for you. It means the data is thin, so read the routes as hints for where to look, not as a ranking.`,
        ]
      : []),
    ...realWarnings,
  ];
  const [firstStep, ...otherSteps] = result.next_steps;
  const place = [goal.role, goal.city ?? goal.country].filter(Boolean).join(" in ");

  return (
    <div className={styles.root}>
      {/* 1. The answer and the goal */}
      {bestItem && (
        <ToolHero
          lead="At least"
          numeral={<HeroNumber value={bestK} label={`${bestK} people`} />}
          say={
            readN !== null
              ? `of the ${fmtInt(readN)} people in ${place || "this role"} whose careers we read took the route that fits you best.`
              : "people took the route that fits you best."
          }
          note={result.summary}
          actions={
            <>
              {bestToken ? (
                <Button variant="primary" onClick={() => drill.open(bestToken, bestTitle)}>
                  {`See the ${fmtInt(bestK)} people on this route`}
                </Button>
              ) : (
                firstStep && (
                  <ButtonLink href={toolHref(firstStep.tool, firstStep.params)} variant="primary">
                    {firstStep.label}
                  </ButtonLink>
                )
              )}
            </>
          }
          aside={cohort ? <CohortCard result={result} title="Who we looked at" /> : undefined}
        />
      )}
      <div className={styles.context}>
        <GoalEditor key={goalText(goal)} initial={goal} evidence={evNode} />
        {notes.length > 0 && (
          <div className={styles.notice}>
            <Notes lines={notes} />
            {widenPart && isThin && (
              <ButtonLink href={toolHref("reverse_gps", { ...goal, [widenPart!]: undefined })} variant="secondary" size="sm">
                Try it without the {PART_LABEL[widenPart].toLowerCase()}
              </ButtonLink>
            )}
          </div>
        )}
      </div>
      {goalSection && <p className={`${styles.read} visually-hidden`}>{(goalSection.data as TextData).text}</p>}

      {/* 2. Routes as a wall of tiles, best fit first */}
      {routes.length > 0 ? (
        <>
          <TileRow
            band
            title={routeSection?.title ?? "Routes that fit you"}
            note={`${routes.length} ${routes.length === 1 ? "route" : "routes"} · people who took each, of ${readN !== null ? fmtInt(readN) : "those we read"}`}
            label="Routes to your goal"
          >
            {routes.map((r, i) => {
              const steps = r.steps.slice(1).map((st) => st.label);
              /* the goal is the same on every route, so the tile names the way there */
              const via = steps.slice(0, -1).join(" → ");
              return (
                <RouteTile
                  key={r.id}
                  title={r.title ?? (via || steps.join(" → ") || `Route ${i + 1}`)}
                  steps={steps}
                  people={peopleK(r)}
                  years={r.typical_years}
                  hue={((i % 4) + 1) as 1 | 2 | 3 | 4}
                  badge={r.id === best ? "Fits you best" : undefined}
                  drill={drillOf(r) ?? null}
                />
              );
            })}
          </TileRow>

          <section className={styles.detail} aria-label="Each route in detail">
            <SectionHead
              title="Route by route"
              meta="Each block is one step. Open a route to see the people on it."
            />
            <ol className={styles.routes} aria-label="Routes to your goal, in detail">
              {routes.map((r, i) => (
                <RouteBlock key={r.id} route={r} rank={i + 1} best={r.id === best} total={routes.length} />
              ))}
            </ol>
            {allRoutes.length > MAX_ROUTES && (
              <p className={styles.more}>Showing the top {MAX_ROUTES} of {allRoutes.length} routes.</p>
            )}
          </section>
        </>
      ) : (
        routeSection && (
          <Panel title={routeSection.title} evidence={evNode} as="section">
            <p className={styles.empty}>
              We could not find a route that fits your starting point yet. Try a broader goal, such as the role without the city.
            </p>
          </Panel>
        )
      )}

      {/* 3. Supporting panels */}
      {lacking && (
        <Panel title={kwSection?.title ?? "Skills to add"} evidence={evNode} caption={kw?.caption} as="section">
          {lacking.items.length > 0 ? (
            <KeywordList data={lacking} />
          ) : (
            <p className={styles.prose}>You already list every skill that is common in this role. Nicely done.</p>
          )}
          {have.length > 0 && (
            <p className={styles.have}>
              <b>Already on your profile:</b> {have.join(", ")}.
            </p>
          )}
        </Panel>
      )}
      {others.map((s) => (
        <SectionView key={s.id} section={s} evidence={result.evidence} result={result} />
      ))}

      <ResultFoot result={{ ...result, next_steps: bestToken ? result.next_steps : otherSteps }} />
    </div>
  );
}
