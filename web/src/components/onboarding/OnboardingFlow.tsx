"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError, IS_MOCK } from "@/lib/api";
import { formatMonth, initials } from "@/lib/format";
import { setProfileId, useProfileId } from "@/lib/profile-store";
import type { ChatMessage, Education, Experience, Goals, Person, ProfileResponse } from "@/lib/types";
import { GridFill } from "@/components/data/GridFill";
import { Panel } from "@/components/data/Panel";
import { BrandMark } from "@/components/shell/BrandMark";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { ExampleBadge } from "@/components/ui/ExampleBadge";
import { InlineError } from "@/components/ui/InlineError";
import { Input } from "@/components/ui/Input";
import { GoalsEditor, INTENTS, PERSONAS } from "./GoalsEditor";
import styles from "./Onboarding.module.css";

type Step = "url" | "reading" | "review" | "chat" | "confirm";
const STEP_ORDER: { id: Step; label: string }[] = [
  { id: "url", label: "Your profile" },
  { id: "review", label: "Check it" },
  { id: "chat", label: "Your goals" },
  { id: "confirm", label: "Confirm" },
];

const EXAMPLE_URL = "https://www.linkedin.com/in/riya-menon";
const EXAMPLE_UNIVERSITY_URL = "https://www.linkedin.com/in/anjali-iyer-careers";

/** Accepts "linkedin.com/in/x", "in.linkedin.com/in/x/", with or without https. */
export function normaliseLinkedIn(raw: string): { url?: string; error?: string } {
  const v = raw.trim();
  if (!v) return { error: "Paste the link to your LinkedIn profile to continue." };
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  let u: URL;
  try {
    u = new URL(withScheme);
  } catch {
    return { error: "That doesn't look like a web link. It should start with linkedin.com/in/" };
  }
  if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return { error: "That link isn't on LinkedIn. Open your LinkedIn profile and copy the address from the browser bar." };
  const m = /^\/in\/([^/]+)\/?$/.exec(u.pathname);
  if (!m) return { error: "That's a LinkedIn link, but not a profile. Profile links look like linkedin.com/in/your-name" };
  return { url: `https://www.linkedin.com/in/${m[1]}` };
}

function StepIndicator({ step }: { step: Step }) {
  const current = step === "reading" ? "url" : step;
  const idx = STEP_ORDER.findIndex((s) => s.id === current);
  return (
    <ol className={styles.steps} aria-label="Onboarding progress">
      {STEP_ORDER.map((s, i) => (
        <li
          key={s.id}
          className={[styles.step, i < idx && styles.stepDone, i === idx && styles.stepCurrent].filter(Boolean).join(" ")}
          aria-current={i === idx ? "step" : undefined}
        >
          <span className={styles.stepBox} aria-hidden="true" />
          <span className={styles.stepLabel}>
            {s.label}
            {i < idx && <span className="visually-hidden"> (done)</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Step 1: the LinkedIn link                                           */
/* ------------------------------------------------------------------ */

function UrlStep({ initialError, onSubmit }: { initialError?: string; onSubmit: (url: string) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | undefined>(initialError);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = normaliseLinkedIn(value);
    setError(r.error);
    if (r.url) onSubmit(r.url);
  };
  return (
    <div className={styles.intro}>
      <div className={styles.pitch}>
        <h1 className={styles.headline}>See where people like you ended up.</h1>
        <p className={styles.lede}>
          Paste your LinkedIn profile. We&apos;ll find people who started where you did and show where they are now, with the counts behind every
          number.
        </p>
        <ul className={styles.facts}>
          <li>About three minutes, start to finish.</li>
          <li>We read only your own public profile.</li>
          <li>Nobody else&apos;s name or profile is ever shown to you.</li>
        </ul>
      </div>
      <Panel title="Your LinkedIn profile" as="div">
        <form className={styles.urlForm} onSubmit={submit} noValidate>
          <Input
            label="Profile link"
            name="linkedin_url"
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="linkedin.com/in/your-name"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(undefined);
            }}
            error={error}
            hint="Open your profile on LinkedIn and copy the address from the browser bar."
            autoFocus
          />
          <p className={styles.privacy}>
            We look up this one profile to read your education, work history and skills. You can correct anything we get wrong on the next
            screen.
          </p>
          <div className={styles.formActions}>
            <Button type="submit">Read my profile</Button>
          </div>
          {IS_MOCK && (
            <p className={styles.examples}>
              Or try an example:{" "}
              <button type="button" className={styles.linkButton} onClick={() => setValue(EXAMPLE_URL)}>
                student going abroad
              </button>
              {" · "}
              <button type="button" className={styles.linkButton} onClick={() => setValue(EXAMPLE_UNIVERSITY_URL)}>
                university career office
              </button>
            </p>
          )}
        </form>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2: reading                                                     */
/* ------------------------------------------------------------------ */

const READING = ["Finding your public profile", "Reading your education", "Reading your work history", "Reading your skills"];

function ReadingStep() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => Math.min(x + 1, 95)), 120);
    return () => window.clearInterval(t);
  }, []);
  const stage = Math.min(READING.length - 1, Math.floor(tick / 6));
  return (
    <div className={styles.reading}>
      <h1 className={styles.readingTitle}>Reading your profile</h1>
      <div role="status" aria-live="polite">
        <span className="visually-hidden">{READING[stage]}</span>
      </div>
      <GridFill done={tick} total={100} cells={96} size={24} onOrange />
      <ul className={styles.readingList} aria-hidden="true">
        {READING.map((r, i) => (
          <li key={r}>
            <i className={i < stage ? styles.readDone : undefined} />
            {r}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 3: the user's own profile, with edits                          */
/* ------------------------------------------------------------------ */

function CareerStrip({ person }: { person: Person }) {
  const years: number[] = [];
  const startYear = Math.min(...person.education.map((e) => e.start_year ?? 9999), ...person.experience.map((x) => Number(x.start_date?.slice(0, 4) ?? 9999)));
  const endYear = 2026;
  const first = Number.isFinite(startYear) && startYear < 9999 ? Math.max(startYear, endYear - 11) : endYear - 5;
  for (let y = first; y <= endYear; y++) years.push(y);
  const studying = (y: number) => person.education.some((e) => e.start_year != null && e.end_year != null && y >= e.start_year && y < e.end_year);
  const kind = (y: number) => {
    const jobs = person.experience.filter((x) => {
      const s = Number(x.start_date?.slice(0, 4));
      const e = x.end_date ? Number(x.end_date.slice(0, 4)) : endYear;
      return y >= s && y <= e;
    });
    if (jobs.some((j) => !/intern|trainee|student/i.test(j.title))) return "work";
    if (jobs.length) return "intern";
    return null;
  };
  return (
    <div className={styles.strip} style={{ ["--years" as string]: years.length }}>
      <div className={styles.stripRow} aria-hidden="true">
        <span />
        {years.map((y) => (
          <span key={y} className={styles.stripYears}>
            ’{String(y).slice(2)}
          </span>
        ))}
      </div>
      <div className={styles.stripRow}>
        <span>Studying</span>
        {years.map((y) => (
          <i key={y} className={[styles.stripCell, studying(y) && styles.stripStudy].filter(Boolean).join(" ")} />
        ))}
      </div>
      <div className={styles.stripRow}>
        <span>Working</span>
        {years.map((y) => {
          const k = kind(y);
          return <i key={y} className={[styles.stripCell, k === "work" && styles.stripWork, k === "intern" && styles.stripIntern].filter(Boolean).join(" ")} />;
        })}
      </div>
    </div>
  );
}

function EducationItem({ e, onChange }: { e: Education; onChange: (e: Education) => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <li className={styles.entry}>
      <div>
        <p className={styles.entryTitle}>
          {e.degree}
          {e.field ? `, ${e.field}` : ""}
        </p>
        <p className={styles.entryMeta}>{e.school}</p>
      </div>
      <div>
        <p className={styles.entryDates}>
          {e.start_year ?? "?"} to {e.end_year ?? "now"}
        </p>
        <button type="button" className={styles.linkButton} aria-expanded={editing} onClick={() => setEditing((x) => !x)}>
          {editing ? "Done" : "Edit"}
        </button>
      </div>
      {editing && (
        <div className={styles.editRow}>
          <Input label="Degree" value={e.degree} onChange={(ev) => onChange({ ...e, degree: ev.target.value })} />
          <Input label="Field" value={e.field} onChange={(ev) => onChange({ ...e, field: ev.target.value })} />
          <Input label="School" value={e.school} onChange={(ev) => onChange({ ...e, school: ev.target.value })} />
          <Input label="Finished" inputMode="numeric" value={e.end_year ?? ""} onChange={(ev) => onChange({ ...e, end_year: Number(ev.target.value) || null })} />
        </div>
      )}
    </li>
  );
}

function ExperienceItem({ x, onChange }: { x: Experience; onChange: (x: Experience) => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <li className={styles.entry}>
      <div>
        <p className={styles.entryTitle}>{x.title}</p>
        <p className={styles.entryMeta}>{x.company}</p>
      </div>
      <div>
        <p className={styles.entryDates}>
          {formatMonth(x.start_date)} to {formatMonth(x.end_date)}
        </p>
        <button type="button" className={styles.linkButton} aria-expanded={editing} onClick={() => setEditing((v) => !v)}>
          {editing ? "Done" : "Edit"}
        </button>
      </div>
      {editing && (
        <div className={styles.editRow}>
          <Input label="Title" value={x.title} onChange={(ev) => onChange({ ...x, title: ev.target.value })} />
          <Input label="Company" value={x.company} onChange={(ev) => onChange({ ...x, company: ev.target.value })} />
        </div>
      )}
    </li>
  );
}

function ReviewStep({
  person,
  onChange,
  onConfirm,
  onBack,
  busy,
}: {
  person: Person;
  onChange: (p: Person) => void;
  onConfirm: () => void;
  onBack: () => void;
  busy: boolean;
}) {
  const [skill, setSkill] = useState("");
  const addSkill = (e: FormEvent) => {
    e.preventDefault();
    const s = skill.trim();
    if (s && !person.skills.includes(s)) onChange({ ...person, skills: [...person.skills, s] });
    setSkill("");
  };
  return (
    <>
      <div className={styles.reviewHead}>
        <h1 className={styles.pageTitle}>Is this you?</h1>
        <p className={styles.pageLede}>
          This is what your public profile says. Everything we show you later starts from here, so fix anything that&apos;s wrong or out of date.
        </p>
      </div>
      <div className={styles.reviewGrid}>
        <Panel title="You" as="div" className={styles.full}>
          <div className={styles.person}>
            <span className={styles.avatar} aria-hidden="true">
              {initials(person.name)}
            </span>
            <div>
              <p className={styles.personName}>{person.name}</p>
              <p>{person.headline}</p>
              <p className={styles.muted}>{[person.location.city, person.location.country].filter(Boolean).join(", ")}</p>
            </div>
          </div>
          <div style={{ marginTop: "var(--ad-space-3)" }}>
            <CareerStrip person={person} />
          </div>
        </Panel>
        <Panel title="Education" as="div">
          <ul className={styles.entries}>
            {person.education.map((e, i) => (
              <EducationItem key={i} e={e} onChange={(ne) => onChange({ ...person, education: person.education.map((x, k) => (k === i ? ne : x)) })} />
            ))}
          </ul>
        </Panel>
        <Panel title="Work" as="div">
          <ul className={styles.entries}>
            {person.experience.map((x, i) => (
              <ExperienceItem key={i} x={x} onChange={(nx) => onChange({ ...person, experience: person.experience.map((y, k) => (k === i ? nx : y)) })} />
            ))}
          </ul>
        </Panel>
        <Panel title="Skills" as="div" className={styles.full}>
          <div className={styles.chips}>
            {person.skills.map((s) => (
              <Chip key={s} onRemove={() => onChange({ ...person, skills: person.skills.filter((x) => x !== s) })}>
                {s}
              </Chip>
            ))}
          </div>
          <form className={styles.addRow} onSubmit={addSkill}>
            <Input label="Add a skill" value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="e.g. Airflow" />
            <Button type="submit" variant="secondary" slash={false}>
              Add
            </Button>
          </form>
        </Panel>
      </div>
      <div className={styles.footerActions}>
        <Button onClick={onConfirm} loading={busy}>
          Yes, this is me
        </Button>
        <button type="button" className={styles.backLink} onClick={onBack}>
          Use a different profile
        </button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Step 4: mentor conversation                                         */
/* ------------------------------------------------------------------ */

function ChatStep({
  messages,
  pending,
  suggestions,
  done,
  error,
  goals,
  onSend,
  onEdit,
  onContinue,
  onRetry,
}: {
  messages: ChatMessage[];
  pending: boolean;
  suggestions: string[];
  done: boolean;
  error: ApiError | null;
  goals: Goals;
  onSend: (text: string) => void;
  onEdit: <K extends keyof Goals>(key: K, value: Goals[K]) => void;
  onContinue: () => void;
  onRetry: () => void;
}) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, pending]);
  const send = (e: FormEvent) => {
    e.preventDefault();
    const t = draft.trim();
    if (!t || pending) return;
    onSend(t);
    setDraft("");
  };
  return (
    <>
      <div className={styles.reviewHead}>
        <h1 className={styles.pageTitle}>A few questions about where you&apos;re headed</h1>
        <p className={styles.pageLede}>Answer in your own words or tap a reply. What I pick up appears on the right, and you can change it there.</p>
      </div>
      <div className={styles.chatGrid}>
        <Panel title="Your mentor" as="div">
          <div className={styles.chat}>
            <ol ref={listRef} className={styles.messages} aria-live="polite" aria-label="Conversation">
              {messages.map((m, i) => (
                <li key={i} className={[styles.msg, m.role === "user" && styles.msgUser].filter(Boolean).join(" ")}>
                  {m.role === "assistant" && (
                    <span className={styles.msgMark} aria-hidden="true">
                      <BrandMark size={18} />
                    </span>
                  )}
                  <p className={styles.msgBody}>
                    <span className="visually-hidden">{m.role === "assistant" ? "Mentor: " : "You: "}</span>
                    {m.content}
                  </p>
                </li>
              ))}
              {pending && (
                <li className={styles.msg}>
                  <span className={styles.msgMark} aria-hidden="true">
                    <BrandMark size={18} />
                  </span>
                  <span className={styles.typing}>
                    <span className="visually-hidden">Mentor is writing</span>
                    <i aria-hidden="true" />
                    <i aria-hidden="true" />
                    <i aria-hidden="true" />
                  </span>
                </li>
              )}
            </ol>
            {error && <InlineError title="The mentor didn't answer" message={error.message} hint={error.hint} onRetry={onRetry} />}
            {!pending && suggestions.length > 0 && (
              <div className={styles.suggestions} aria-label="Suggested replies" role="group">
                {suggestions.map((s) => (
                  <Button key={s} variant="secondary" size="sm" slash={false} onClick={() => onSend(s)}>
                    {s}
                  </Button>
                ))}
              </div>
            )}
            {done ? (
              <div className={styles.footerActions}>
                <Button onClick={onContinue}>That&apos;s right, continue</Button>
              </div>
            ) : (
              <form className={styles.composer} onSubmit={send}>
                <Input label="Your reply" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type your answer" disabled={pending} autoComplete="off" />
                <Button type="submit" disabled={pending || !draft.trim()}>
                  Send
                </Button>
              </form>
            )}
          </div>
        </Panel>
        <Panel title="What I've understood" as="div">
          <GoalsEditor goals={goals} onEdit={onEdit} />
        </Panel>
      </div>
      {!done && (
        <div className={styles.footerActions}>
          <button type="button" className={styles.backLink} onClick={onContinue}>
            Skip the rest of the questions
          </button>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Step 5: confirm                                                     */
/* ------------------------------------------------------------------ */

function ConfirmStep({ goals, person, busy, error, onConfirm, onBack }: { goals: Goals; person: Person; busy: boolean; error: ApiError | null; onConfirm: () => void; onBack: () => void }) {
  const uni = goals.persona === "university";
  const list = (v: string[]) => (v.length ? v.join(", ") : "Not set");
  return (
    <div className={styles.confirm}>
      <div className={styles.reviewHead}>
        <h1 className={styles.pageTitle}>{uni ? "Ready to see where your graduates went" : "Ready to see people like you"}</h1>
        <p className={styles.pageLede}>
          {uni
            ? "Every screen will show your graduates as the cohort. You can change this any time from your profile."
            : "Every screen starts from your background and these goals. You can change them any time from your profile."}
        </p>
      </div>
      <Panel title={person.name} as="div">
        <dl className={styles.summaryList}>
          <dt>You are</dt>
          <dd>{PERSONAS.find((p) => p.value === goals.persona)?.label}</dd>
          {uni ? (
            <>
              <dt>Institution</dt>
              <dd>{goals.institution ?? "Not set"}</dd>
              <dt>Programs</dt>
              <dd>{list(goals.programs)}</dd>
            </>
          ) : (
            <>
              <dt>Next step</dt>
              <dd>{INTENTS.find((i) => i.value === (goals.intent ?? ""))?.label}</dd>
              <dt>Roles</dt>
              <dd>{list(goals.target_roles)}</dd>
              <dt>Places</dt>
              <dd>{list([...goals.target_cities, ...goals.target_countries])}</dd>
              {goals.constraints.length > 0 && (
                <>
                  <dt>Keep in mind</dt>
                  <dd>{list(goals.constraints)}</dd>
                </>
              )}
            </>
          )}
        </dl>
      </Panel>
      {error && <InlineError title="We couldn't save that" message={error.message} hint={error.hint} onRetry={onConfirm} />}
      <div className={styles.footerActions}>
        <Button onClick={onConfirm} loading={busy}>
          {uni ? "Show me where our graduates are" : "Show me people like me"}
        </Button>
        <button type="button" className={styles.backLink} onClick={onBack}>
          Change my goals
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Flow                                                                */
/* ------------------------------------------------------------------ */

const asError = (e: unknown) => (e instanceof ApiError ? e : new ApiError(0, { code: "unknown", message: "Something unexpected happened.", hint: "Try again." }));

function emptyGoals(p: ProfileResponse): Goals {
  const uni = p.derived.persona_guess === "university";
  return {
    persona: p.derived.persona_guess,
    intent: uni ? "program_insights" : null,
    target_roles: [],
    target_countries: [],
    target_cities: [],
    target_companies: [],
    institution: uni ? p.derived.current_company : null,
    programs: [],
    constraints: [],
  };
}

function describeCorrections(before: Person, after: Person): string | null {
  const changes: string[] = [];
  after.education.forEach((e, i) => {
    const b = before.education[i];
    if (b && JSON.stringify(b) !== JSON.stringify(e)) changes.push(`my education is ${e.degree} ${e.field} at ${e.school}${e.end_year ? `, finished ${e.end_year}` : ""}`);
  });
  after.experience.forEach((x, i) => {
    const b = before.experience[i];
    if (b && (b.title !== x.title || b.company !== x.company)) changes.push(`I worked as ${x.title} at ${x.company}`);
  });
  const added = after.skills.filter((s) => !before.skills.includes(s));
  const removed = before.skills.filter((s) => !after.skills.includes(s));
  if (added.length) changes.push(`I also know ${added.join(", ")}`);
  if (removed.length) changes.push(`I don't really use ${removed.join(", ")}`);
  return changes.length ? `I checked my profile and fixed a few things: ${changes.join("; ")}.` : null;
}

export function OnboardingFlow() {
  const router = useRouter();
  const search = useSearchParams();
  const storedId = useProfileId();
  const editing = search.get("edit") === "1";

  const [step, setStep] = useState<Step>("url");
  const [urlError, setUrlError] = useState<string | undefined>();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [goals, setGoals] = useState<Goals | null>(null);
  const [edited, setEdited] = useState<Set<keyof Goals>>(new Set());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [chatDone, setChatDone] = useState(false);
  const [chatError, setChatError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<ApiError | null>(null);
  const loadedEdit = useRef(false);

  // Returning user editing their profile: start at the review step with what we stored.
  useEffect(() => {
    if (!editing || !storedId || loadedEdit.current) return;
    loadedEdit.current = true;
    api
      .getProfile(storedId)
      .then((p) => {
        setProfile(p);
        setPerson(p.person);
        setGoals(p.goals ?? emptyGoals(p));
        if (p.goals) setEdited(new Set(Object.keys(p.goals) as (keyof Goals)[]));
        setStep("review");
      })
      .catch(() => undefined);
  }, [editing, storedId]);

  const readProfile = (url: string) => {
    setUrlError(undefined);
    setStep("reading");
    api
      .createProfile(url)
      .then((p) => {
        setProfile(p);
        setPerson(p.person);
        setGoals(emptyGoals(p));
        setEdited(new Set());
        setMessages([]);
        setChatDone(false);
        setStep("review");
      })
      .catch((e: unknown) => {
        const err = asError(e);
        setUrlError([err.message, err.hint].filter(Boolean).join(" "));
        setStep("url");
      });
  };

  const talk = useCallback(
    (msgs: ChatMessage[]) => {
      if (!profile) return;
      setPending(true);
      setChatError(null);
      api
        .chat(profile.profile_id, msgs)
        .then((res) => {
          setMessages([...msgs, { role: "assistant", content: res.reply }]);
          setSuggestions(res.suggested_replies ?? []);
          setChatDone(res.done);
          setGoals((g) => {
            if (!g) return res.goals;
            const next = { ...res.goals };
            edited.forEach((k) => {
              (next as Record<string, unknown>)[k] = g[k];
            });
            return next;
          });
        })
        .catch((e: unknown) => setChatError(asError(e)))
        .finally(() => setPending(false));
    },
    [profile, edited],
  );

  const startChat = () => {
    if (!profile || !person) return;
    setStep("chat");
    if (messages.length) return;
    const opener = describeCorrections(profile.person, person) ?? "I've checked my profile and it's right.";
    const msgs: ChatMessage[] = [{ role: "user", content: opener }];
    setMessages(msgs);
    talk(msgs);
  };

  const send = (text: string) => {
    const msgs: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(msgs);
    setSuggestions([]);
    talk(msgs);
  };

  const editGoal = <K extends keyof Goals>(key: K, value: Goals[K]) => {
    setGoals((g) => (g ? { ...g, [key]: value, ...(key === "persona" && value === "university" && !g.institution ? { institution: profile?.derived.current_company ?? null } : {}) } : g));
    setEdited((s) => new Set(s).add(key));
  };

  const complete = () => {
    if (!profile || !goals) return;
    setSaving(true);
    setSaveError(null);
    api
      .complete(profile.profile_id, goals)
      .then((res) => {
        setProfileId(res.profile_id);
        router.push("/home");
      })
      .catch((e: unknown) => {
        setSaveError(asError(e));
        setSaving(false);
      });
  };

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.header}>
          {storedId ? (
            <Link href="/home" className={styles.brand}>
              <BrandMark />
              AfterDegree
            </Link>
          ) : (
            <span className={styles.brand}>
              <BrandMark />
              AfterDegree
            </span>
          )}
          <ExampleBadge>Example data mode</ExampleBadge>
        </header>
        <StepIndicator step={step} />
        <main id="main" className={styles.inner}>
          {step === "url" && <UrlStep initialError={urlError} onSubmit={readProfile} key={urlError ?? "url"} />}
          {step === "reading" && <ReadingStep />}
          {step === "review" && person && <ReviewStep person={person} onChange={setPerson} onConfirm={startChat} onBack={() => setStep("url")} busy={false} />}
          {step === "chat" && goals && (
            <ChatStep
              messages={messages}
              pending={pending}
              suggestions={suggestions}
              done={chatDone}
              error={chatError}
              goals={goals}
              onSend={send}
              onEdit={editGoal}
              onContinue={() => setStep("confirm")}
              onRetry={() => talk(messages)}
            />
          )}
          {step === "confirm" && goals && person && <ConfirmStep goals={goals} person={person} busy={saving} error={saveError} onConfirm={complete} onBack={() => setStep("chat")} />}
        </main>
      </div>
    </div>
  );
}
