import type { ChatMessage, ChatResponse, Goals, Intent, ProfileResponse } from "@/lib/types";

const COUNTRIES = ["Germany", "Netherlands", "United Kingdom", "Ireland", "Canada", "United States", "Australia", "Sweden", "France", "Singapore"];
const COUNTRY_ALIASES: Record<string, string> = { uk: "United Kingdom", usa: "United States", us: "United States", america: "United States", holland: "Netherlands" };
const CITIES = ["Berlin", "Munich", "Hamburg", "Frankfurt", "Amsterdam", "Rotterdam", "London", "Dublin", "Toronto", "Stockholm", "Paris"];
const ROLES = ["Data Engineer", "Data Scientist", "ML Engineer", "Software Engineer", "Data Analyst", "Product Manager", "Analytics Engineer"];

function extract(text: string, goals: Goals): Goals {
  const t = ` ${text.toLowerCase()} `;
  const add = (list: string[], v: string) => (list.includes(v) ? list : [...list, v]);
  let g = { ...goals };
  for (const c of COUNTRIES) if (t.includes(c.toLowerCase())) g.target_countries = add(g.target_countries, c);
  for (const [alias, c] of Object.entries(COUNTRY_ALIASES)) if (t.includes(` ${alias} `)) g.target_countries = add(g.target_countries, c);
  for (const c of CITIES) if (t.includes(c.toLowerCase())) g.target_cities = add(g.target_cities, c);
  for (const r of ROLES) if (t.includes(r.toLowerCase())) g.target_roles = add(g.target_roles, r);
  const intent: [RegExp, Intent][] = [
    [/master|\bms\b|msc|degree/, "masters_abroad"],
    [/job abroad|move abroad|work abroad|directly/, "job_abroad"],
    [/switch|change role|different role/, "switch_role"],
    [/grow|promotion|stay/, "grow_in_place"],
  ];
  for (const [re, i] of intent) if (re.test(t)) { g.intent = i; break; }
  if (/budget|lakh|timing|start in|20\d\d|visa|family/.test(t)) g = { ...g, constraints: add(g.constraints, text.trim()) };
  return g;
}

const STUDENT_SCRIPT = (p: ProfileResponse) => [
  {
    reply: `Hi ${p.person.name.split(" ")[0]}, thanks for sharing your profile. I can see a BTech in ${p.derived.undergrad_field?.replace("Computer Science and Engineering", "Computer Science")} from ${p.derived.undergrad_school} (${p.derived.undergrad_end_year}) and about ${Math.round(p.derived.years_experience ?? 0)} years at ${p.derived.current_company}. Did I get that right?`,
    suggested: ["Yes, that's right", "Mostly, but I want to fix something"],
  },
  {
    reply: "Good. What are you hoping to do next? There's no wrong answer, and you can change it later.",
    suggested: ["A master's abroad, then a job there", "A job abroad directly", "Switch to a different role"],
  },
  {
    reply: "Which countries are you weighing up? Name as many as you like.",
    suggested: ["Germany", "Germany or the Netherlands", "Not sure yet"],
  },
  {
    reply: "And what kind of role would you like to end up in?",
    suggested: ["Data Engineer", "Data Scientist", "ML Engineer"],
  },
  {
    reply: "Last one: anything I should keep in mind, like budget, timing or language?",
    suggested: ["Budget under 30 lakh", "I'd like to start in 2027", "Nothing else"],
  },
];

const UNIVERSITY_SCRIPT = (p: ProfileResponse) => [
  {
    reply: `Hi ${p.person.name.split(" ")[0]}. It looks like you work at ${p.derived.current_company}. Are you here on behalf of the university, to see where your graduates end up?`,
    suggested: ["Yes, for the university", "No, I'm here for myself"],
  },
  {
    reply: "Which programs should I follow? I'll treat their graduates as the cohort on every screen.",
    suggested: ["BTech Computer Science and Engineering", "All BTech programs", "MCA"],
  },
  {
    reply: "Are there countries or roles you'd especially like to watch for your graduates?",
    suggested: ["Germany and the United States", "Data roles", "No preference"],
  },
];

export function mockChat(profile: ProfileResponse, messages: ChatMessage[], goals: Goals): ChatResponse {
  const university = goals.persona === "university";
  const script = university ? UNIVERSITY_SCRIPT(profile) : STUDENT_SCRIPT(profile);
  let g = { ...goals };
  const userTurns = messages.filter((m) => m.role === "user");
  for (const m of userTurns) {
    g = extract(m.content, g);
    if (university && /program|btech|mca|mtech|msc|computer/i.test(m.content)) {
      const prog = m.content.trim();
      if (!g.programs.includes(prog) && !/^yes|^no/i.test(prog)) g.programs = [...g.programs, prog];
    }
    if (university && /myself/i.test(m.content)) g.persona = "professional";
  }
  const turn = userTurns.length;
  if (turn >= script.length) {
    const summary = university
      ? `Thanks. I'll show ${g.institution ?? "your institution"}'s graduates on every screen${g.programs.length ? `, starting with ${g.programs.join(", ")}` : ""}. Check the goals on the right, then confirm.`
      : `Thanks, that's everything I need. I'll look for people like you who went to ${g.target_countries.join(" or ") || "the places you named"}${g.target_roles.length ? ` and became ${g.target_roles.join(" or ")}` : ""}. Check the goals on the right and confirm when they look right.`;
    return { reply: summary, done: true, goals: g, suggested_replies: [] };
  }
  const step = script[turn];
  return { reply: step.reply, done: false, goals: g, suggested_replies: step.suggested };
}
