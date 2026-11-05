"""Helpers shared by the tool modules."""

from __future__ import annotations

from collections import Counter
from collections.abc import Callable
from typing import Any

from .. import filters as F
from .. import taxonomy as tx
from ..schemas import Count, NextStep
from ..stats import OTHER_LABEL, distribution, fold_small, make_count
from ..toolkit import ToolContext, ToolInputError, section


def place_text(city: str | None, country: str | None) -> str:
    if city and country:
        return f"{city}, {country}"
    return city or country or "anywhere"


def resolve_place(city: str | None, country: str | None, required_country: bool = False) -> tuple[str | None, str | None]:
    c = tx.canonical_city(city) if city else None
    k = tx.canonical_country(country) if country else None
    if c and not k:
        k = tx.country_for_city(c)
    if required_country and not k:
        raise ToolInputError(
            "Which country should I look at?",
            hint="Add a country, for example Germany or the Netherlands.",
        )
    return c, k


def require_role(role: str | None) -> str:
    role = (role or "").strip()
    if not role:
        raise ToolInputError("Which role should I look at?", hint="Add a role, for example Data Engineer.")
    if len(role) > 80:
        raise ToolInputError("That role description is a bit long for me.", hint="Use a short job title, like Data Engineer.")
    return role


def title_or(path: str, role: str) -> dict:
    cond = F.phrase_any(f"{path}.title", tx.role_phrases(role))
    assert cond is not None
    return cond


def job_title_or(role: str) -> dict:
    cond = F.phrase_any("job_details.title", tx.role_phrases(role))
    assert cond is not None
    return cond


DrillFn = Callable[[str], "dict | None"]


def distribution_section(id_: str, title: str, counts: dict[str, int] | Counter, n: int, evidence_ids: list[str],
                         unit: str | None = None, caption: str | None = None, top: int | None = 8, other_label: str = OTHER_LABEL,
                         target: str | None = None, remainders: dict[str, int] | None = None, keep_order: bool = False,
                         drill: DrillFn | None = None, sample_n: int | None = None):
    """Distribution with folded small groups. `drill(label)` returns the token for an item (never for the folded "Other" item)."""
    items, _ = distribution(dict(counts), n, top=top, other_label=other_label, target=target, remainders=remainders, keep_order=keep_order)
    if drill is not None:
        for it in items:
            if it["label"] == other_label:
                continue
            tok = drill(it["label"])
            if tok:
                it["drill"] = tok
    return section(id_, "distribution", title, {"n": n, "items": items, "unit": unit, "caption": caption, "sample_n": sample_n}, evidence_ids)


def counts_table_section(
    id_: str,
    title: str,
    key: str,
    header: str,
    counts: dict[str, int] | Counter,
    n: int,
    evidence_ids: list[str],
    you_label: str | None = None,
    other_label: str = OTHER_LABEL,
    top: int = 10,
    caption: str | None = None,
    drill: DrillFn | None = None,
    empty_note: str | None = None,
    sample_n: int | None = None,
):
    """Two-column table (name, people) with a bar; groups under 5 people fold into a muted `rest` row.
    When no group reaches 5 people, the table is empty and carries a short `note` instead of an "Other"-only row."""
    kept, other = fold_small(dict(counts), top=top)
    rows: list[dict[str, Any]] = []
    for label, k in kept:
        row = {
            "id": _slug(label),
            "cells": {key: label, "people": k},
            "count": make_count(k, n, evidence_ids).model_dump(),
            "you": bool(you_label and label.lower() == you_label.lower()),
        }
        tok = drill(label) if drill is not None else None
        if tok:
            row["drill"] = tok
        rows.append(row)
    note = None
    if other and not kept:
        note = empty_note or (f"None of the {other} people in the profiles read share a {header.lower()} with 4 others, "
                              "so no single one can be shown without pointing at individuals.")
        rows = []
        caption = f"{caption}. {note}" if caption else note
    elif other:
        rows.append({"id": "other", "cells": {key: other_label, "people": other}, "count": make_count(other, n, evidence_ids).model_dump(), "rest": True})
    columns = [{"key": key, "label": header, "type": "text"}, {"key": "people", "label": "People", "type": "int", "bar": True}]
    return section(id_, "ranked_table", title, {"n": n, "columns": columns, "rows": rows, "caption": caption, "note": note,
                                                "sample_n": sample_n}, evidence_ids)


def _slug(text: str) -> str:
    import re

    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60] or "row"


def pct(count: Count) -> str:
    if count.share is None:
        return count.display
    return f"{count.display} ({count.share * 100:.0f}%)"


def step(label: str, tool: str, **params: Any) -> NextStep:
    return NextStep(label=label, tool=tool, params={k: v for k, v in params.items() if v not in (None, "", [])})  # type: ignore[arg-type]


def user_target_country(ctx: ToolContext) -> str | None:
    countries = ctx.goals.get("target_countries") or []
    return countries[0] if countries else None


def user_target_role(ctx: ToolContext) -> str | None:
    roles = ctx.goals.get("target_roles") or []
    if roles:
        return roles[0]
    fam = tx.title_family(ctx.derived.get("current_title"))
    return None if fam == "Intern / Working Student" else fam


def company_value(name: str | None, company_id: Any = None) -> str | None:
    """Drill value for a company: its Crustdata id when known (exact), else its name."""
    if company_id not in (None, "", 0):
        try:
            return str(int(company_id))
        except (TypeError, ValueError):
            pass
    return name or None


def company_value_from_key(key: str, name: str) -> str:
    """From Role.company_key() ('id:123' / 'name:sap') to a drill value."""
    if key.startswith("id:"):
        return key[3:]
    return name
