"use client";

import type { Evidence, ResultEnvelope, Section, StatData } from "@/lib/types";
import { fmtInt } from "@/lib/format";
import { toolHref } from "@/lib/tools";
import { Panel } from "@/components/data/Panel";
import { EvidenceKey } from "@/components/data/EvidenceKey";
import { CountDisplay } from "@/components/data/CountDisplay";
import { Distribution } from "@/components/data/Distribution";
import { SectionView } from "@/components/data/ResultView";
import { ButtonLink } from "@/components/ui/Button";
import { CohortCard, HeroNumber, Notes, ResultFoot, ToolHero } from "@/components/tool/ToolHero";
import { drillOf } from "@/components/data/Drillable";
import type { FeatureViewProps } from "../types";
import { CellSplit } from "./CellSplit";
import { StackedCells } from "./StackedCells";
import { EmployersTable } from "./EmployersTable";
import { EmployerTiles } from "./EmployerTiles";
import { SkillList } from "./SkillList";
import styles from "./View.module.css";

type StatSection = Extract<Section, { kind: "stat" }>;

function evidenceFor(result: ResultEnvelope, section: Section): Evidence[] {
  const ids = section.evidence_ids;
  return ids?.length ? result.evidence.filter((e) => ids.includes(e.id)) : result.evidence;
}

/** Pick a section by its id, falling back to a pattern on id, title or label. */
function pickStat(sections: Section[], id: string, pattern: RegExp): StatSection | undefined {
  const stats = sections.filter((s): s is StatSection => s.kind === "stat");
  return stats.find((s) => s.id === id) ?? stats.find((s) => pattern.test(`${s.id} ${s.title} ${s.data.label}`));
}

const statValue = (d?: StatData) => d?.value ?? d?.count?.k ?? null;

export function View({ result }: FeatureViewProps) {
  const warnings = result.warnings.filter((w) => !/^example data/i.test(w));

  const sections = result.sections;
  const now = pickStat(sections, "open_90", /\b90\b/);
  const prev = pickStat(sections, "open_prev", /previous|before/i);
  const d30 = pickStat(sections, "open_30", /\b30\b/);
  const visa = pickStat(sections, "visa", /visa|sponsor/i);
  const trend = sections.find((s) => s.kind === "timeseries");
  const lang = sections.find((s) => s.kind === "distribution" && (s.id === "languages" || /language/i.test(s.title)));
  const skills = sections.find((s) => s.kind === "keywords");
  const employers = sections.find((s) => s.kind === "ranked_table" && (s.id === "employers" || /hire/i.test(JSON.stringify(s.data.columns))));
  const used = new Set<Section | undefined>([now, prev, d30, visa, trend, lang, skills, employers]);

  const value = statValue(now?.data);
  const nPostings = value ?? undefined;
  const thin = nPostings !== undefined && nPostings < 10;
  const rest = sections.filter((s) => !used.has(s));
  const dists = rest.filter((s): s is Extract<Section, { kind: "distribution" }> => s.kind === "distribution");
  const tail = rest.filter((s) => s.kind !== "distribution");

  const ev = (s?: Section) => (s ? evidenceFor(result, s) : result.evidence);
  const first = result.next_steps[0];
  const before = statValue(prev?.data);

  let change: string | null = null;
  if (value !== null && before !== null && before !== undefined) {
    if (value < 10 || before < 10) {
      change = `${fmtInt(before)} in the 90 days before. Too few postings to call a trend.`;
    } else {
      const pct = Math.round(((value - before) / before) * 100);
      change =
        pct === 0
          ? `About the same as the 90 days before (${fmtInt(before)}).`
          : `${pct > 0 ? "Up" : "Down"} ${Math.abs(pct)}% on the 90 days before (${fmtInt(before)}).`;
    }
  }
  const last30 = d30 && statValue(d30.data) !== null ? `${fmtInt(statValue(d30.data)!)} ${d30.data.label.replace(/^postings\s+/i, "")}.` : null;

  return (
    <div className={styles.view}>
      {now && value !== null ? (
        <ToolHero
          numeral={<HeroNumber value={value} label={`${fmtInt(value)} ${now.data.label}`} />}
          say={now.data.label}
          note={[change, last30].filter(Boolean).join(" ")}
          actions={first && <ButtonLink href={toolHref(first.tool, first.params)}>{first.label}</ButtonLink>}
          aside={<CohortCard result={result} title="What we counted" n={value} definition={result.title} />}
        />
      ) : null}

      {result.summary && <p className={styles.summary}>{result.summary}</p>}
      <Notes lines={[...(thin ? [`Only ${fmtInt(nPostings!)} postings turned up, so we show counts and skip shares and trends.`] : []), ...warnings]} />

      {employers && employers.kind === "ranked_table" && <EmployerTiles section={employers} result={result} />}

      <div className={styles.grid}>
        {trend && trend.kind === "timeseries" && (
          <Panel
            className={dists.length ? styles.span7 : styles.span12}
            title={trend.title}
            caption={trend.data.caption}
            evidence={<EvidenceKey n={nPostings} date={result.data_date} evidence={ev(trend)} />}
          >
            <StackedCells data={trend.data} />
          </Panel>
        )}

        {dists.map((s) => (
          <Panel
            key={s.id}
            className={styles.span5}
            title={s.title}
            caption={s.data.caption}
            evidence={<EvidenceKey n={s.data.n} date={result.data_date} evidence={ev(s)} />}
          >
            <Distribution data={s.data} />
          </Panel>
        ))}

        {lang && lang.kind === "distribution" && (
          <Panel
            className={styles.span7}
            title={lang.title}
            caption={lang.data.caption}
            evidence={<EvidenceKey n={lang.data.n} date={result.data_date} evidence={ev(lang)} />}
          >
            <CellSplit
              parts={lang.data.items.map((i) => ({ label: i.label, count: i.count, drill: drillOf(i) }))}
              total={lang.data.n || lang.data.items.reduce((s, i) => s + i.count, 0)}
              unit={lang.data.unit ?? "postings"}
              label={`${lang.title}: ${lang.data.items.map((i) => `${i.label} ${i.count}`).join(", ")}`}
            />
          </Panel>
        )}

        {visa && visa.data.count && (
          <Panel
            className={lang ? styles.span5 : styles.span12}
            title={visa.title}
            evidence={<EvidenceKey n={visa.data.count.n} date={result.data_date} evidence={ev(visa)} />}
          >
            <div className={styles.visa}>
              <p className={styles.visaCount}>
                <CountDisplay count={visa.data.count} size="lg" showShare />
              </p>
              <p className={styles.say}>{visa.data.label}</p>
              <CellSplit
                parts={[
                  { label: "Mention it", count: visa.data.count.k, drill: drillOf(visa) ?? drillOf(visa.data) },
                  { label: "Do not mention it", count: Math.max(0, visa.data.count.n - visa.data.count.k) },
                ]}
                total={visa.data.count.n}
                label={`${visa.data.count.display} postings mention visa sponsorship`}
              />
              <p className={styles.fine}>A posting that stays silent may still sponsor. Ask the employer before you apply.</p>
            </div>
          </Panel>
        )}

        {skills && skills.kind === "keywords" && (
          <Panel
            className={styles.span12}
            title={skills.title}
            caption={skills.data.caption}
            evidence={<EvidenceKey n={skills.data.n} date={result.data_date} evidence={ev(skills)} />}
          >
            <SkillList data={skills.data} />
          </Panel>
        )}

        {employers && employers.kind === "ranked_table" && (
          <Panel
            className={styles.span12}
            title={employers.title}
            caption={employers.data.caption}
            evidence={<EvidenceKey n={employers.data.n} date={result.data_date} evidence={ev(employers)} />}
          >
            <EmployersTable data={employers.data} />
          </Panel>
        )}

        {tail.map((s) => (
          <div key={s.id} className={styles.span12}>
            <SectionView section={s} evidence={ev(s)} result={result} />
          </div>
        ))}
      </div>

      <ResultFoot result={{ ...result, next_steps: result.next_steps.slice(1) }} primary={false} />
    </div>
  );
}
