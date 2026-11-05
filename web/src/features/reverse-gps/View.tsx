"use client";

import Form from "next/form";
import { useMemo, useState, type ReactNode } from "react";
import { CountDisplay } from "@/components/data/CountDisplay";
import { EvidenceKey } from "@/components/data/EvidenceKey";
import { KeywordList } from "@/components/data/KeywordList";
import { Panel } from "@/components/data/Panel";
import { SectionView } from "@/components/data/ResultView";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { ExampleBadge } from "@/components/ui/ExampleBadge";
import { Input } from "@/components/ui/Input";
import { formatDate } from "@/lib/format";
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
    >
      <Form action="/tools/reverse-gps" className={styles.goalForm}>
        <input type="hidden" name="goal_text" value={goalText(parts)} />
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

function RouteBlock({
  route,
  rank,
  selected,
  best,
  onSelect,
  total,
}: {
  route: RouteListItem;
  rank: number;
  selected: boolean;
  best: boolean;
  onSelect: () => void;
  total: number;
}) {
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

  return (
    <li className={[styles.route, selected ? styles.on : ""].join(" ")}>
      <header className={styles.routeHead}>
        <div className={styles.routeTitle}>
          <span className={styles.routeNo}>{rank}</span>
          <div>
            <h3>{route.title ?? `Route ${rank}`}</h3>
            <p className={styles.meta}>
              {best && <b className={styles.tag}>Best fit</b>}
              {route.fit && <span>{FIT_LABEL[route.fit]}</span>}
              {route.typical_years != null && <span>Typically {yearsText(route.typical_years)}</span>}
            </p>
          </div>
        </div>
        <div className={styles.routeSide}>
          <span className={styles.people}>
            {typeof people === "number" ? `${people} people` : <CountDisplay count={people} size="sm" showShare />}
          </span>
          <button
            type="button"
            className={styles.pickRoute}
            aria-pressed={selected}
            onClick={onSelect}
            aria-label={`${selected ? "Selected" : "Highlight"} route ${rank}: ${route.title ?? ""}`}
          >
            {selected ? "Highlighted" : "Highlight"}
          </button>
        </div>
      </header>

      <ol className={styles.path} aria-label="Steps from you to the goal">
        {route.steps.map((s, i) => (
          <li
            key={`${s.label}-${i}`}
            className={[
              styles.stepWrap,
              "ad-assemble",
            ].join(" ")}
            style={{ ["--i" as string]: rank * 4 + i, ["--n" as string]: total * 4 }}
          >
            {i > 0 && (
              <span className={styles.trail} aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            )}
            <div
              className={[
                styles.step,
                i === 0 ? styles.you : "",
                i === last ? styles.goal : "",
              ].join(" ")}
            >
              <span className={styles.stepLabel}>{s.label}</span>
              {s.years != null && i > 0 && <span className={styles.stepYears}>about {yearsText(s.years)}</span>}
            </div>
          </li>
        ))}
      </ol>

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
  const routeSection = result.sections.find((s): s is Extract<Section, { kind: "route_list" }> => s.kind === "route_list");
  const kwSection = result.sections.find((s): s is Extract<Section, { kind: "keywords" }> => s.kind === "keywords");
  const goalSection = result.sections.find((s): s is Extract<Section, { kind: "text" }> => s.kind === "text" && s.id === "goal");
  const used = new Set([routeSection?.id, kwSection?.id, goalSection?.id].filter(Boolean) as string[]);
  const others = result.sections.filter((s) => !used.has(s.id));

  const allRoutes = (routeSection?.data as RouteListData | undefined)?.routes ?? [];
  const routes = allRoutes.slice(0, MAX_ROUTES);
  const best = bestRoute(routes);
  const [picked, setPicked] = useState<string | null>(null);
  const selected = picked ?? best;

  const goal = useMemo(() => readGoal(result), [result]);
  const cohort = result.cohort;
  const mock = result.warnings.some((w) => /mock mode/i.test(w));
  const realWarnings = result.warnings.filter((w) => !/mock mode/i.test(w));

  const allThin = routes.length > 0 && routes.every((r) => typeof r.people !== "number" && r.people.n < 10);
  const isThin = result.confidence === "low" || Boolean(cohort?.widened) || allThin;
  const widenPart: PartKey | null = goal.city ? "city" : goal.company ? "company" : null;
  const widenedText = widenPart ? goalText({ ...goal, [widenPart]: undefined }) : "";

  const kw = kwSection?.data as KeywordsData | undefined;
  const lacking = kw ? { ...kw, items: kw.items.filter((i) => !i.you_have) } : undefined;
  const have = kw?.items.filter((i) => i.you_have).map((i) => i.term) ?? [];

  const evNode = <EvidenceKey n={cohort?.n_visible} date={formatDate(result.data_date)} evidence={result.evidence} />;

  return (
    <div className={styles.root}>
      {/* 1. Summary and goal */}
      <Panel title="What this shows" as="section">
        {mock && <ExampleBadge force>Example data (mock mode)</ExampleBadge>}
        {result.summary && <p className={styles.summary}>{result.summary}</p>}
        {cohort && (
          <p className={styles.cohort}>
            <b>Who we followed:</b> {cohort.definition}.
          </p>
        )}
        {realWarnings.length > 0 && (
          <ul className={styles.warns} role="list">
            {realWarnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
      </Panel>

      <GoalEditor key={goalText(goal)} initial={goal} evidence={evNode} />
      {goalSection && <p className={styles.read}>{(goalSection.data as TextData).text}</p>}

      {/* 2. Thin data */}
      {isThin && (
        <Panel title="Not many people here yet" as="section" className={styles.thin}>
          <p>
            {cohort?.widened_reason ?? "Only a few people match this goal, so the routes below can swing a lot."} That
            is not a bad sign for you. It means the data is thin, so read the routes as hints for where to look, not as a
            ranking.
          </p>
          {widenPart && (
            <ButtonLink href={toolHref("reverse_gps", { goal_text: widenedText })} variant="secondary" size="sm">
              Try it without the {PART_LABEL[widenPart].toLowerCase()}
            </ButtonLink>
          )}
        </Panel>
      )}

      {/* 3. Signature: routes as stepped cell paths */}
      {routeSection && (
        <Panel
          title={routeSection.title}
          evidence={evNode}
          caption={
            (routeSection.data as RouteListData).caption ??
            "Each block is one step. The route that fits you best is shown in black."
          }
          as="section"
        >
          {routes.length === 0 ? (
            <p className={styles.empty}>
              We could not find a route that fits your starting point yet. Try a broader goal, such as the role without
              the city.
            </p>
          ) : (
            <ol className={styles.routes} aria-label="Routes to your goal">
              {routes.map((r, i) => (
                <RouteBlock
                  key={r.id}
                  route={r}
                  rank={i + 1}
                  selected={r.id === selected}
                  best={r.id === best}
                  onSelect={() => setPicked(r.id === selected && r.id !== best ? null : r.id)}
                  total={routes.length}
                />
              ))}
            </ol>
          )}
          {allRoutes.length > MAX_ROUTES && (
            <p className={styles.more}>Showing the top {MAX_ROUTES} of {allRoutes.length} routes.</p>
          )}
        </Panel>
      )}

      {/* 4. Supporting panels */}
      {lacking && (
        <Panel
          title={kwSection?.title ?? "Skills to add"}
          evidence={evNode}
          caption={kw?.caption}
          as="section"
        >
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

      {/* 5. Next step and coverage */}
      {result.next_steps.length > 0 && (
        <div className={styles.next}>
          {result.next_steps.map((n, i) => (
            <ButtonLink key={n.label} href={toolHref(n.tool, n.params)} variant={i === 0 ? "primary" : "secondary"}>
              {n.label}
            </ButtonLink>
          ))}
        </div>
      )}
      <p className={styles.coverage}>
        {result.coverage_note} Data as of {formatDate(result.data_date)}.
      </p>
    </div>
  );
}
