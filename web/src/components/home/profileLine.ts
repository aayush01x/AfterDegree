import type { Goals, StoredProfile } from "@/lib/types";

const FIELD_SHORT: [RegExp, string][] = [
  [/computer science/i, "CSE"],
  [/electronics and communication/i, "ECE"],
  [/electrical/i, "EEE"],
  [/mechanical/i, "Mech"],
  [/information technology/i, "IT"],
];

export function shortField(field: string | null | undefined): string {
  if (!field) return "";
  for (const [re, s] of FIELD_SHORT) if (re.test(field)) return s;
  return field;
}

export function shortSchool(school: string | null | undefined): string {
  if (!school) return "";
  return school.replace(/^Vellore Institute of Technology,?\s*/i, "VIT ").replace(/\s+/g, " ").trim();
}

/** "Bachelor of Technology - BTech" → "BTech". */
export function shortDegree(degree: string | null | undefined): string {
  if (!degree) return "";
  const abbr = /\b(B\.?\s?Tech|B\.?E\.?|B\.?Sc|BCA|BCom|M\.?Tech|M\.?Sc|MCA|MBA|MS)\b/i.exec(degree);
  if (abbr) return abbr[1].replace(/\./g, "").replace(/\s/g, "").replace(/^btech$/i, "BTech").replace(/^be$/i, "BE");
  if (/bachelor of technology/i.test(degree)) return "BTech";
  if (/bachelor of engineering/i.test(degree)) return "BE";
  return degree;
}

export function aimText(g: Goals | null): string | null {
  if (!g) return null;
  const role = g.target_roles[0];
  const place = g.target_cities[0] ?? g.target_countries[0];
  const where = place ? ` in ${place}` : "";
  switch (g.intent) {
    case "masters_abroad":
      return `MS, then ${role ?? "a job"}${where}`;
    case "job_abroad":
      return `${role ?? "a job"}${where}`;
    case "switch_role":
      return `switch to ${role ?? "a new role"}${where}`;
    case "grow_in_place":
      return `grow as ${role ?? "what you do"}${where}`;
    default:
      return role || place ? `${role ?? "a move"}${where}` : null;
  }
}

/** "BTech CSE, VIT Vellore ’22 · 2 yrs at Infosys" */
export function backgroundLine(p: StoredProfile): string {
  const ug = p.person.education.find((e) => /b\.?tech|b\.?e\b|bachelor|bsc|bcom/i.test(e.degree)) ?? p.person.education[0];
  const parts: string[] = [];
  if (ug) {
    const yr = ug.end_year ? ` ’${String(ug.end_year).slice(2)}` : "";
    parts.push(`${shortDegree(ug.degree)} ${shortField(ug.field)}, ${shortSchool(ug.school)}${yr}`.trim());
  }
  const d = p.derived;
  if (d.current_company) {
    const years = d.years_experience != null ? `${Math.max(1, Math.round(d.years_experience))} yrs at ` : "at ";
    parts.push(`${years}${d.current_company}`);
  }
  return parts.join(" · ");
}
