"use client";

import type { Evidence, RankedRow, ResultEnvelope, Section } from "@/lib/types";
import { isCount } from "@/lib/count";
import { fmtInt, fmtPct } from "@/lib/format";
import { Panel } from "@/components/data/Panel";
import { EvidenceKey } from "@/components/data/EvidenceKey";
import { RankedTable } from "@/components/data/RankedTable";
import { SectionView } from "@/components/data/ResultView";
import { Drillable, drillOf } from "@/components/data/Drillable";
import { ButtonLink } from "@/components/ui/Button";
import { toolHref } from "@/lib/tools";
import { CohortCard, HeroNumber, Notes, ResultFoot, ToolHero } from "@/components/tool/ToolHero";
import type { FeatureViewProps } from "../types";
import styles from "./View.module.css";

type Of<K extends Section["kind"]> = Extract<Section, { kind: K }>;

const byId = <K extends Section["kind"]>(r: ResultEnvelope, id: string, kind: K) =>
  r.sections.find((s): s is Of<K> => s.id === id && s.kind === kind);

function evidenceFor(result: ResultEnvelope, section: Section): Evidence[] {
  const ids = section.evidence_ids;
  return ids?.length ? result.evidence.filter((e) => ids.includes(e.id)) : result.evidence;
}

const num = (v: unknown) => (typeof v === "number" ? v : isCount(v) ? v.k : 0);
const rateOf = (r: RankedRow) => {
  const c = r.cells.rate;
  return isCount(c) && c.n >= 20 && c.share != null ? c : null;
};

/** One answer card: a named college or programme, its figure, and a drill into its people. */
function Pick({ kicker, row, nameKey, figure }: { kicker: string; row: RankedRow; nameKey: string; figure: React.ReactNode }) {
  const name = String(row.cells[nameKey] ?? "");
  return (
    <Drillable as="div" className={styles.pick} token={drillOf(row) ?? null} label={name} actionLabel={`${name}: see the people`}>
      <span className={styles.pickKicker}>{kicker}</span>
      <span className={styles.pickName}>{name}</span>
      <span className={styles.pickFigure}>{figure}</span>
    </Drillable>
  );
}

export function View({ result }: FeatureViewProps) {
  const size = byId(result, "goal_size", "stat");
  const further = byId(result, "further_degree", "distribution");
  const unis = byId(result, "universities", "ranked_table");
  const progs = byId(result, "programmes", "ranked_table");
  const colleges = byId(result, "indian_colleges", "ranked_table") ?? byId(result, "your_programmes", "ranked_table");
  const method = byId(result, "method", "text");

  const n = num(size?.data.value ?? size?.data.count);
  const goalWords = result.title?.replace(/^Colleges and programmes (that lead )?(to|into)\s*/i, "") || "this goal";
  const uniRows = (unis?.data.rows ?? []).filter((r) => !r.rest);
  const mostPeople = [...uniRows].sort((a, b) => num(b.cells.in_goal) - num(a.cells.in_goal))[0];
  const bestRate = [...uniRows].filter(rateOf).sort((a, b) => (rateOf(b)!.share ?? 0) - (rateOf(a)!.share ?? 0))[0];
  const you = colleges?.data.rows.find((r) => r.you);
  const youRate = you && isCount(you.cells.rate) ? you.cells.rate : null;
  const first = result.next_steps[0];
  const warnings = result.warnings.filter((w) => !/^example data/i.test(w));

  return (
    <div className={styles.view}>
      <ToolHero
        lead="At least"
        numeral={<HeroNumber value={n} label={`${fmtInt(n)} people`} />}
        say={`Indian-educated people ${size?.data.label ? size.data.label.toLowerCase() : `are in ${goalWords}`}.`}
        note={size?.data.note}
        actions={
          first && (
            <ButtonLink href={toolHref(first.tool, first.params)} variant="primary">
              {first.label}
            </ButtonLink>
          )
        }
        aside={<CohortCard result={result} />}
      />

      {result.summary && <p className={styles.summary}>{result.summary}</p>}
      <Notes lines={warnings} />

      {(mostPeople || bestRate || you) && (
        <section className={styles.picks} aria-label="The short answer">
          {mostPeople && (
            <Pick
              kicker="Most people in your goal studied at"
              row={mostPeople}
              nameKey="university"
              figure={
                <>
                  <strong>{fmtInt(num(mostPeople.cells.in_goal))}</strong> of the {fmtInt(n)} people in your goal
                </>
              }
            />
          )}
          {bestRate && bestRate !== mostPeople ? (
            <Pick
              kicker="Best success rate"
              row={bestRate}
              nameKey="university"
              figure={
                <>
                  <strong>{fmtPct(rateOf(bestRate)!.share ?? 0)}</strong> of its {fmtInt(rateOf(bestRate)!.n)} recent Indian graduates got there
                </>
              }
            />
          ) : bestRate ? (
            <Pick
              kicker="It also has the best success rate"
              row={bestRate}
              nameKey="university"
              figure={
                <>
                  <strong>{fmtPct(rateOf(bestRate)!.share ?? 0)}</strong> of its {fmtInt(rateOf(bestRate)!.n)} recent Indian graduates got there
                </>
              }
            />
          ) : null}
          {you && (
            <Pick
              kicker="Your college"
              row={you}
              nameKey={colleges!.data.columns[0].key}
              figure={
                youRate && youRate.n > 0 ? (
                  <>
                    <strong>{fmtInt(youRate.k)}</strong> of {fmtInt(youRate.n)} recent graduates are in this goal ({fmtPct(youRate.share ?? 0)})
                  </>
                ) : (
                  <>{fmtInt(num(you.cells.in_goal))} people in this goal studied there</>
                )
              }
            />
          )}
        </section>
      )}

      {unis && (
        <Panel
          title={unis.title}
          caption={
            unis.data.caption ??
            "In goal: Indian-educated people in your goal who studied there. Success rate: of its Indian graduates from the last 8 years, how many are in your goal now. Press a row to see their paths."
          }
          evidence={<EvidenceKey n={unis.data.n} date={result.data_date} evidence={evidenceFor(result, unis)} />}
        >
          {unis.data.rows.length ? (
            <RankedTable data={{ ...unis.data, caption: undefined }} />
          ) : (
            <p>{(unis.data as { note?: string }).note ?? "No university abroad has 5 or more people in this goal yet."}</p>
          )}
        </Panel>
      )}

      {(progs || colleges) && (
        <div className={styles.two}>
          {progs && (
            <Panel
              title={progs.title}
              caption={progs.data.caption}
              evidence={<EvidenceKey n={progs.data.n} date={result.data_date} evidence={evidenceFor(result, progs)} />}
            >
              <RankedTable data={{ ...progs.data, caption: undefined }} />
            </Panel>
          )}
          {colleges && (
            <Panel
              title={colleges.title}
              caption={colleges.data.caption}
              evidence={<EvidenceKey n={colleges.data.n} date={result.data_date} evidence={evidenceFor(result, colleges)} />}
            >
              <RankedTable data={{ ...colleges.data, caption: undefined }} />
            </Panel>
          )}
        </div>
      )}

      {further && <SectionView section={further} evidence={evidenceFor(result, further)} result={result} />}

      {method && (
        <Panel title={method.title}>
          <p className={styles.method}>{method.data.text}</p>
        </Panel>
      )}

      <ResultFoot result={result} primary={false} />
    </div>
  );
}
