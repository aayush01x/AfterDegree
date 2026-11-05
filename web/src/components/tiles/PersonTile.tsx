"use client";

import type { PersonCard, PersonStep } from "@/lib/drill-types";
import { CareerStrip } from "@/components/art/CareerStrip";
import { CellAvatar } from "@/components/art/CellAvatar";
import { homeCountry, stageOf, stageToken } from "@/components/art/stages";
import { useDrill } from "@/components/drill/useDrill";
import { Chevron } from "@/components/ui/Chevron";
import { Slash } from "@/components/ui/Slash";
import styles from "./PersonTile.module.css";

export interface PersonTileProps {
  person: PersonCard;
  expanded?: boolean;
  from?: number;
  to?: number;
  tone?: "paper" | "band";
  /** Defaults to useDrill().openPerson(id). */
  onOpen?: (id: string) => void;
  openLabel?: string;
  className?: string;
}

const yrs = (s: PersonStep) =>
  s.start_year == null ? "" : `${s.start_year}–${s.end_year == null ? "now" : s.end_year === s.start_year ? s.start_year : s.end_year}`;

/** The step just before the current one: the hinge of most routes (often the working-student job). */
function keyStep(p: PersonCard): PersonStep | undefined {
  const sorted = [...p.steps].sort((a, b) => (a.start_year ?? 0) - (b.start_year ?? 0));
  return sorted.find((s) => s.kind === "internship") ?? sorted[sorted.length - 2];
}

/** An anonymous career card: cell avatar, headline, a year strip of stage colours, why it matches. */
export function PersonTile({ person: p, expanded = false, from, to, tone = "paper", onOpen, openLabel, className }: PersonTileProps) {
  const drill = useDrill();
  const open = onOpen ? () => onOpen(p.id) : drill.enabled ? () => drill.openPerson(p.id) : undefined;
  const since = p.current?.since_year;
  const where = [p.current?.company, p.current?.city].filter(Boolean).join(" · ");
  const title = p.current?.title ?? p.headline;
  const chips = p.match_reasons ?? [];
  const tags = p.tags ?? [];
  const cls = [styles.tile, tone === "band" && styles.band, expanded && styles.expanded, className].filter(Boolean).join(" ");
  const home = homeCountry(p.steps);

  if (expanded) {
    const steps = [...p.steps].sort((a, b) => (a.start_year ?? 0) - (b.start_year ?? 0));
    return (
      <article className={cls} data-tile="" data-expanded="" aria-label={`Career path: ${p.headline}`}>
        <header className={styles.head}>
          <CellAvatar seed={p.id} cell={10} inverse />
          <div>
            <h3 className={styles.htitle}>{p.headline}</h3>
            <p className={styles.hsub}>{since ? `Full-time since ${since} · ` : ""}anonymised path, years only</p>
          </div>
        </header>
        <div className={styles.ebody}>
          {(chips.length > 0 || tags.length > 0) && (
            <ul role="list" className={styles.chips}>
              {chips.map((c) => (
                <li key={c} className={styles.chip}>
                  {c}
                </li>
              ))}
              {tags.map((t) => (
                <li key={t} className={styles.tag}>
                  {t}
                </li>
              ))}
            </ul>
          )}
          <div className={styles.bigStrip}>
            <CareerStrip steps={p.steps} from={from} to={to} cell={40} gap={5} height={20} years="all" />
          </div>
          <ol role="list" className={styles.steps}>
            {steps.map((s, i) => (
              <li key={i}>
                <i className={styles.sw} style={{ background: stageToken(stageOf(s, home)) }} aria-hidden="true" />
                <span className={styles.yrs}>{yrs(s)}</span>
                <span className={styles.what}>
                  <b>{s.org}</b> {s.title}
                </span>
                <span className={styles.cty}>{s.city ?? s.country ?? ""}</span>
              </li>
            ))}
          </ol>
          {open && (
            <button type="button" className={styles.primary} onClick={open}>
              <span>{openLabel ?? "Open full career path"}</span>
              <Slash />
            </button>
          )}
        </div>
      </article>
    );
  }

  const k = keyStep(p);
  return (
    <article className={cls} data-tile="" aria-label={p.headline}>
      <div className={styles.top}>
        <span data-art="">
          <CellAvatar seed={p.id} inverse={tone === "band"} />
        </span>
        {since && <span className={styles.since}>since {since}</span>}
      </div>
      <h3 className={styles.title}>{title}</h3>
      {where && <p className={styles.sub}>{where}</p>}
      <div className={styles.strip} data-art="">
        <CareerStrip steps={p.steps} from={from} to={to} cell={16} gap={2} tone={tone} />
      </div>
      {k && (
        <p className={styles.key}>
          <b>
            {k.org} {k.title?.toLowerCase()}
          </b>
          <br />
          {yrs(k)}
        </p>
      )}
      {(chips.length > 0 || tags.length > 0) && (
        <ul role="list" className={styles.chips}>
          {chips.map((c) => (
            <li key={c} className={styles.chip}>
              {c}
            </li>
          ))}
          {tags.map((t) => (
            <li key={t} className={styles.tag}>
              {t}
            </li>
          ))}
        </ul>
      )}
      {open && (
        <button type="button" className={styles.view} onClick={open} aria-label={`View path: ${p.headline}`}>
          <span>View path</span>
          <Chevron />
        </button>
      )}
    </article>
  );
}
