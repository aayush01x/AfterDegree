"use client";

import type { Evidence, ResultEnvelope, Section } from "@/lib/types";
import { fmtInt } from "@/lib/format";
import { Panel } from "@/components/data/Panel";
import { EvidenceKey } from "@/components/data/EvidenceKey";
import { RankedTable } from "@/components/data/RankedTable";
import { ButtonLink } from "@/components/ui/Button";
import { toolHref } from "@/lib/tools";
import { CohortCard, HeroNumber, Notes, ResultFoot, ToolHero } from "@/components/tool/ToolHero";
import type { FeatureViewProps } from "../types";
import { FlowGraph } from "./FlowGraph";
import { CellColumns } from "./CellColumns";
import { FeederTiles } from "./FeederTiles";
import styles from "./View.module.css";

type Of<K extends Section["kind"]> = Extract<Section, { kind: K }>;

function evidenceFor(result: ResultEnvelope, section: Section): Evidence[] {
  const ids = section.evidence_ids;
  return ids?.length ? result.evidence.filter((e) => ids.includes(e.id)) : result.evidence;
}

function isYears(s: Section): s is Of<"distribution"> {
  return s.kind === "distribution" && (s.id === "years" || /year|experience/i.test(s.title));
}

/** "Data Engineer, Berlin" -> { role: "Data Engineer", place: "Berlin" } */
function splitGoal(label: string) {
  const parts = label.split(/\s*[,·]\s*/);
  return { role: parts[0] ?? label, place: parts.slice(1).join(", ") };
}

export function View({ result }: FeatureViewProps) {
  const warnings = result.warnings.filter((w) => !/^example data/i.test(w));
  const n = result.cohort?.n_visible;
  const thin = n !== undefined && n < 10;

  const graph = result.sections.find((s): s is Of<"routes"> => s.kind === "routes");
  const feeders = result.sections.find((s): s is Of<"ranked_table"> => s.kind === "ranked_table" && s.id === "feeders");
  const years = result.sections.find(isYears);
  const tables = result.sections.filter((s): s is Of<"ranked_table"> => s.kind === "ranked_table" && s !== feeders);
  const others = result.sections.filter((s) => s !== graph && s !== feeders && s !== years && !tables.includes(s as Of<"ranked_table">));

  const goal = graph?.data.nodes.find((x) => x.kind === "goal");
  const where = goal ? splitGoal(goal.label) : null;
  const first = result.next_steps[0];
  const topYears = years ? [...years.data.items].sort((a, b) => b.count - a.count)[0] : undefined;

  const notes = [
    ...(thin ? [`Only ${fmtInt(n!)} ${n === 1 ? "person" : "people"} match, so we show counts without calling any route typical.`] : []),
    ...warnings,
  ];

  return (
    <div className={styles.view}>
      <ToolHero
        lead={thin ? "So far" : "At least"}
        numeral={<HeroNumber value={n ?? 0} label={`${fmtInt(n ?? 0)} people`} />}
        say={where ? `${n === 1 ? "person" : "people"} work as ${where.role}${where.place ? ` in ${where.place}` : ""} today.` : `${n === 1 ? "person" : "people"} we can see in this position.`}
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
      <Notes lines={notes} />

      {graph && (
        <Panel
          title={graph.title}
          caption={graph.data.caption}
          evidence={<EvidenceKey n={n ?? undefined} date={result.data_date} evidence={evidenceFor(result, graph)} note={result.coverage_note} />}
        >
          <FlowGraph data={graph.data} label={`${graph.title}: lines from employers to titles to the position`} />
        </Panel>
      )}

      {feeders && <FeederTiles section={feeders} result={result} />}

      {tables.length > 0 && (
        <div className={tables.length > 1 ? styles.two : styles.one}>
          {tables.map((s) => (
            <Panel
              key={s.id}
              title={s.title}
              caption={s.data.caption}
              evidence={<EvidenceKey n={s.data.n} date={result.data_date} evidence={evidenceFor(result, s)} />}
            >
              <RankedTable data={{ ...s.data, caption: undefined }} />
            </Panel>
          ))}
        </div>
      )}

      {years && (
        <Panel
          title={years.title}
          caption={years.data.caption}
          evidence={<EvidenceKey n={years.data.n} date={result.data_date} evidence={evidenceFor(result, years)} />}
        >
          <CellColumns data={years.data} />
          {topYears && years.data.n >= 10 && (
            <p className={styles.reading}>
              Most common: {topYears.label.toLowerCase()}, {fmtInt(topYears.count)} of {fmtInt(years.data.n)} people.
            </p>
          )}
        </Panel>
      )}

      {others.map((s) => (
        <Panel key={s.id} title={s.title}>
          <p>{s.kind === "text" ? s.data.text : null}</p>
        </Panel>
      ))}

      <ResultFoot result={{ ...result, next_steps: result.next_steps.slice(1) }} primary={false} />
    </div>
  );
}
