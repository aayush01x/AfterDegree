"""Honest numbers: counts with Wilson intervals, small-row folding, medians."""

from __future__ import annotations

import math
from collections import Counter
from collections.abc import Iterable, Sequence

from .schemas import Count

MIN_N_FOR_SHARE = 10
MIN_ROW_COUNT = 5
OTHER_LABEL = "Other"


def wilson_interval(k: int, n: int, z: float = 1.959964) -> tuple[float, float]:
    """95% Wilson score interval for k successes out of n."""
    if n <= 0:
        raise ValueError("n must be positive")
    if k < 0 or k > n:
        raise ValueError("k must be within [0, n]")
    p = k / n
    denom = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denom
    half = (z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / denom
    lo = 0.0 if k == 0 else max(0.0, centre - half)
    hi = 1.0 if k == n else min(1.0, centre + half)
    return lo, hi


def make_count(k: int, n: int, evidence_ids: Sequence[str] | None = None) -> Count:
    """The only way a proportion is shown. n<10 gets no share and no interval."""
    k = int(max(0, k))
    n = int(max(0, n))
    if k > n:
        n = k
    ev = list(evidence_ids or [])
    if n < MIN_N_FOR_SHARE:
        return Count(k=k, n=n, display=f"{k} of {n} (too few to compare)", share=None, ci=None, evidence_ids=ev)
    lo, hi = wilson_interval(k, n)
    return Count(
        k=k,
        n=n,
        display=f"at least {k:,} of {n:,}",
        share=round(k / n, 3),
        ci=[round(lo, 3), round(hi, 3)],
        evidence_ids=ev,
    )


def fold_small(
    counts: dict[str, int] | Iterable[tuple[str, int]],
    min_count: int = MIN_ROW_COUNT,
    top: int | None = None,
) -> tuple[list[tuple[str, int]], int]:
    """Sort rows by count, keep rows with count >= min_count (and within `top`),
    and fold the rest into a single "Other" bucket. Returns (rows, other_total).

    Privacy rule: a row with fewer than `min_count` people is never shown on its own.
    """
    items = list(counts.items()) if isinstance(counts, dict) else list(counts)
    items = [(label, int(c)) for label, c in items if c > 0]
    items.sort(key=lambda kv: (-kv[1], kv[0]))
    kept: list[tuple[str, int]] = []
    other = 0
    for label, c in items:
        if c >= min_count and label != OTHER_LABEL and (top is None or len(kept) < top):
            kept.append((label, c))
        else:
            other += c
    return kept, other


def share_of(k: int, n: int) -> float | None:
    """Plain share for display next to a count; withheld when n < 10."""
    return round(k / n, 3) if n >= MIN_N_FOR_SHARE and n > 0 else None


def distribution(
    counts: dict[str, int],
    n: int,
    min_count: int = MIN_ROW_COUNT,
    top: int | None = 8,
    other_label: str = OTHER_LABEL,
    target: str | None = None,
    remainders: dict[str, int] | None = None,
    keep_order: bool = False,
) -> tuple[list[dict], int]:
    """Distribution items {label, count, share, target, remainder}; rows under min_count fold into other_label.
    `remainders` (e.g. "Still in India") are appended as hollow remainder rows."""
    if keep_order:
        items_in = [(k, v) for k, v in counts.items() if v > 0]
        kept = [(k, v) for k, v in items_in if v >= min_count]
        other = sum(v for k, v in items_in if v < min_count)
    else:
        kept, other = fold_small(counts, min_count=min_count, top=top)
    tgt = (target or "").lower()
    items = [{"label": label, "count": c, "share": share_of(c, n), "target": bool(tgt and label.lower() == tgt), "remainder": False}
             for label, c in kept]
    if target:  # the user's target goes first
        items.sort(key=lambda i: not i["target"])
    if other > 0:
        items.append({"label": other_label, "count": other, "share": share_of(other, n), "target": False, "remainder": False})
    for label, c in (remainders or {}).items():
        if c > 0:
            items.append({"label": label, "count": c, "share": share_of(c, n), "target": False, "remainder": True})
    return items, other


def counter_of(values: Iterable[str | None]) -> Counter:
    return Counter(v for v in values if v)


def median(values: Iterable[float | int | None]) -> float | None:
    data = sorted(float(v) for v in values if v is not None)
    if not data:
        return None
    mid = len(data) // 2
    if len(data) % 2:
        return data[mid]
    return (data[mid - 1] + data[mid]) / 2


def quantile(values: Iterable[float | int | None], q: float) -> float | None:
    data = sorted(float(v) for v in values if v is not None)
    if not data:
        return None
    if len(data) == 1:
        return data[0]
    pos = (len(data) - 1) * q
    lo = math.floor(pos)
    hi = math.ceil(pos)
    return data[lo] + (data[hi] - data[lo]) * (pos - lo)


def bucket_years(years: float | None) -> str | None:
    if years is None:
        return None
    if years < 1:
        return "Under 1 year"
    if years < 3:
        return "1–3 years"
    if years < 5:
        return "3–5 years"
    if years < 8:
        return "5–8 years"
    return "8+ years"


YEAR_BUCKET_ORDER = ["Under 1 year", "1–3 years", "3–5 years", "5–8 years", "8+ years"]


def confidence_level(n: int, widened: bool = False, sample_n: int | None = None) -> str:
    """high / medium / low from the size of the evidence."""
    base = n if sample_n is None else min(n, max(sample_n, 0) * 4)
    if n < MIN_N_FOR_SHARE or (sample_n is not None and sample_n < MIN_N_FOR_SHARE):
        return "low"
    if base >= 100 and not widened:
        return "high"
    if base >= 30:
        return "medium"
    return "low"
