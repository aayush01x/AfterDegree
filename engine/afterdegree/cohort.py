"""Cohorts of "people like you", with labelled auto-widening exact_school → school_tier → field_only."""

from __future__ import annotations

from dataclasses import dataclass, field

from . import filters as F
from . import taxonomy as tx
from .schemas import Cohort
from .toolkit import ToolContext, ToolInputError

LEVELS = ["exact_school", "school_tier", "field_only"]
MIN_COHORT = 10


@dataclass
class CohortPlan:
    level: str
    definition: str
    edu: dict | None
    extra: list[dict] = field(default_factory=list)
    description: dict = field(default_factory=dict)

    def filters(self, *more: dict | None) -> dict:
        built = F.and_(self.edu, *self.extra, *more)
        return built or F.india_educated()


@dataclass
class BuiltCohort:
    plan: CohortPlan
    n: int
    evidence_id: str | None
    widened: bool
    widened_reason: str | None
    tried: list[tuple[str, int]]

    def model(self) -> Cohort:
        return Cohort(
            definition=self.plan.definition,
            filters={**self.plan.description, "crustdata": self.plan.filters()},
            n_visible=self.n,
            match_level=self.plan.level,  # type: ignore[arg-type]
            widened=self.widened,
            widened_reason=self.widened_reason,
        )

    def filters(self, *more: dict | None) -> dict:
        return self.plan.filters(*more)


def year_window(ctx: ToolContext) -> tuple[int, int] | None:
    y = ctx.derived.get("undergrad_end_year")
    if not y:
        return None
    return int(y) - 2, min(int(y) + 2, ctx.today.year)


def _exp_text(exp_band: list[float] | None) -> str:
    if not exp_band:
        return ""
    lo, hi = exp_band[0], exp_band[1] if len(exp_band) > 1 else exp_band[0]
    return f", with {lo:g}–{hi:g} years of work"


def _exp_filters(exp_band: list[float] | None) -> list[dict]:
    if not exp_band:
        return []
    lo = float(exp_band[0])
    hi = float(exp_band[1]) if len(exp_band) > 1 else lo
    if lo > hi:
        lo, hi = hi, lo
    return [F.cond("years_of_experience_raw", "=>", lo), F.cond("years_of_experience_raw", "=<", hi)]


async def plan_for_level(ctx: ToolContext, level: str, exp_band: list[float] | None = None, with_years: bool = True) -> CohortPlan | None:
    school = ctx.derived.get("undergrad_school")
    field_label, field_phrase = tx.normalise_field(ctx.derived.get("undergrad_field"))
    years = year_window(ctx) if with_years else None
    yr_text = f" ({years[0]}–{years[1]})" if years else ""
    field_text = f"{field_label} graduates" if field_label else "Graduates"
    extra = _exp_filters(exp_band)
    desc = {"school": school, "field": field_label, "end_years": list(years) if years else None, "exp_band": exp_band}

    if level == "exact_school":
        if not school:
            return None
        variants = await ctx.school_variants(school)
        edu = F.education_group(schools=variants, field_phrase=field_phrase, end_year_range=years)
        return CohortPlan(level, f"{field_text} of {tx.short_school(school)}{yr_text}{_exp_text(exp_band)}", edu, extra,
                          {**desc, "school_variants": variants})
    if level == "school_tier":
        tier = tx.school_tier(school)
        if tier is not None:
            edu = F.education_group(school_phrases=list(tier.phrases), field_phrase=field_phrase, end_year_range=years)
            return CohortPlan(level, f"{field_text} of {tier.label}{yr_text}{_exp_text(exp_band)}", edu, extra,
                              {**desc, "tier": tier.key})
        edu = F.education_group(field_phrase=field_phrase, end_year_range=years, india_located=True)
        return CohortPlan(level, f"{field_text} of universities in India{yr_text}{_exp_text(exp_band)}", edu, extra,
                          {**desc, "tier": "india_located"})
    if level == "field_only":
        edu = F.education_group(field_phrase=field_phrase, end_year_range=years)
        india = F.india_educated()
        return CohortPlan(level, f"Indian-educated {field_text.lower() if field_label else 'graduates'}{yr_text}{_exp_text(exp_band)}",
                          F.and_(edu, india), extra, {**desc, "india_educated": True})
    raise ToolInputError(f"Unknown match level '{level}'.", hint="Use exact_school, school_tier or field_only.")


async def university_plan(ctx: ToolContext, institution: str, programs: list[str] | None) -> CohortPlan:
    variants = await ctx.school_variants(institution)
    phrases = []
    labels = []
    for p in programs or []:
        label, phrase = tx.normalise_field(p)
        if phrase:
            phrases.append(phrase)
            labels.append(label)
    years = (ctx.today.year - 8, ctx.today.year)
    parts = [F.cond(f"{F.EDU}.school", "in", variants)]
    if phrases:
        parts.append(F.phrase_any(f"{F.EDU}.field_of_study", phrases))
    parts += [F.cond(f"{F.EDU}.end_year", "=>", years[0]), F.cond(f"{F.EDU}.end_year", "=<", years[1])]
    edu = F.and_(*parts)
    prog = f" ({', '.join(labels)})" if labels else ""
    return CohortPlan(
        "exact_school",
        f"Your graduates: {tx.short_school(institution)}{prog}, classes of {years[0]}–{years[1]}",
        edu,
        [],
        {"institution": institution, "programs": programs or [], "end_years": list(years), "school_variants": variants},
    )


async def build_cohort(
    ctx: ToolContext,
    start: str = "exact_school",
    exp_band: list[float] | None = None,
    extra: list[dict] | None = None,
    min_n: int = MIN_COHORT,
    noun: str = "visible profiles",
) -> BuiltCohort:
    """Count the cohort at the requested level; widen while it has fewer than min_n people."""
    extra = [e for e in (extra or []) if e]
    institution = ctx.params.get("institution") or (ctx.goals.get("institution") if ctx.is_university else None)
    if institution:
        plan = await university_plan(ctx, institution, ctx.params.get("programs") or ctx.goals.get("programs"))
        plan.extra += extra
        n, ev = await ctx.count_people(plan.filters(), "Cohort size")
        built = BuiltCohort(plan, n, ev, False, None, [(plan.level, n)])
        if n < min_n:
            ctx.warn(f"Only {n} of your graduates are visible for this question, so treat every number here as a rough signal.")
        return built
    if ctx.is_university:
        raise ToolInputError(
            "Tell me which institution you represent so I can look at your graduates.",
            hint="Add an institution (and optionally programs) to your profile goals or this request.",
        )
    if start not in LEVELS:
        raise ToolInputError(f"Unknown match level '{start}'.", hint="Use exact_school, school_tier or field_only.")

    tried: list[tuple[str, int]] = []
    chosen: tuple[CohortPlan, int, str] | None = None
    best: tuple[CohortPlan, int, str] | None = None
    for level in LEVELS[LEVELS.index(start):]:
        plan = await plan_for_level(ctx, level, exp_band)
        if plan is None:
            continue
        plan.extra += extra
        n, ev = await ctx.count_people(plan.filters(), f"Cohort size ({level.replace('_', ' ')})")
        tried.append((level, n))
        if best is None or n > best[1]:
            best = (plan, n, ev)
        if n >= min_n:
            chosen = (plan, n, ev)
            break
    if chosen is None:
        if best is None:
            raise ToolInputError(
                "I need a bit more of your background (school or field of study) to find people like you.",
                hint="Check the education section of your profile.",
            )
        chosen = best
    plan, n, ev = chosen
    widened = plan.level != start
    reason = None
    if widened:
        first_level, first_n = tried[0]
        reason = (
            f"Only {first_n} {noun} matched at the {first_level.replace('_', ' ')} level, "
            f"so I widened the group to {plan.definition[0].lower() + plan.definition[1:]}."
        )
    if n < min_n:
        ctx.warn(f"Even the widest group has only {n} {noun}, so this is a rough signal, not a verdict.")
    return BuiltCohort(plan, n, ev, widened, reason, tried)
