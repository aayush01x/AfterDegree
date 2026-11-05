"""Attach drill tokens (CONTRACT Appendix C) to drillable items in a finished tool result.

Applied once, generically, to every tool result: each distribution item, ranked-table row and
route gets {tool, params, path:[{dimension, value, label}]} so the UI can open a drill-down.
"Other"/folded rows and items that already carry a token are left alone.
"""

from __future__ import annotations

from typing import Any

_SKIP_LABELS = ("other", "elsewhere", "at other", "still in india")


def _dimension(section_id: str) -> str | None:
    s = section_id.lower()
    if "degree_countr" in s:
        return "degree_country"
    if "countr" in s or "destination" in s:
        return "country"
    if "cit" in s or "office" in s:
        return "city"
    if any(k in s for k in ("employer", "compan", "feeder", "converter", "ladder", "posting_employer")):
        return "company"
    if "role" in s or "title" in s or "position" in s:
        return "role"
    if "school" in s or "program" in s or "college" in s:
        return "school"
    if "degree" in s:
        return "degree"
    if "route" in s:
        return "route"
    if "senior" in s:
        return "seniority"
    if "skill" in s:
        return "skill"
    if "language" in s:
        return "language"
    if "year" in s or "experience" in s:
        return "years_band"
    return None


def _skip(label: str) -> bool:
    low = label.strip().lower()
    return not low or any(low.startswith(p) for p in _SKIP_LABELS)


def _token(tool: str, params: dict, dimension: str, value: str, label: str) -> dict:
    return {"tool": tool, "params": params, "path": [{"dimension": dimension, "value": value, "label": label}]}


def attach_drill_tokens(tool: str, params: dict[str, Any], result: dict[str, Any]) -> dict[str, Any]:
    clean = {k: v for k, v in (params or {}).items() if k != "profile_id"}
    for section in result.get("sections") or []:
        dim = _dimension(str(section.get("id") or ""))
        data = section.get("data") or {}
        kind = section.get("kind")
        if dim is None or not isinstance(data, dict):
            continue
        if kind == "distribution":
            for item in data.get("items") or []:
                label = str(item.get("label") or "")
                if "drill" in item or item.get("remainder") or _skip(label):
                    continue
                item["drill"] = _token(tool, clean, dim, label, label)
        elif kind == "ranked_table":
            cols = data.get("columns") or []
            first = cols[0].get("key") if cols else None
            for row in data.get("rows") or []:
                if "drill" in row or row.get("rest"):
                    continue
                cells = row.get("cells") or {}
                label = cells.get(first) if first else None
                if not isinstance(label, str) or _skip(label):
                    continue
                row["drill"] = _token(tool, clean, dim, label, label)
        elif kind == "route_list":
            for route in data.get("routes") or []:
                if "drill" in route:
                    continue
                title = route.get("title") or " → ".join(s.get("label", "") for s in route.get("steps") or [])
                route["drill"] = _token(tool, clean, "route", str(route.get("id") or title), title)
    return result
