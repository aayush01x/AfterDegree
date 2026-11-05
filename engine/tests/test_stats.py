import pytest

from afterdegree.stats import (
    confidence_level,
    distribution,
    fold_small,
    make_count,
    median,
    quantile,
    wilson_interval,
)


def test_wilson_matches_contract_example():
    lo, hi = wilson_interval(24, 37)
    assert round(lo, 2) == 0.49
    assert round(hi, 2) == 0.78


@pytest.mark.parametrize("k,n", [(0, 10), (10, 10), (1, 1000), (500, 1000)])
def test_wilson_bounds(k, n):
    lo, hi = wilson_interval(k, n)
    assert 0.0 <= lo <= k / n <= hi <= 1.0


def test_wilson_rejects_bad_input():
    with pytest.raises(ValueError):
        wilson_interval(1, 0)
    with pytest.raises(ValueError):
        wilson_interval(5, 4)


def test_count_display_and_ci():
    c = make_count(24, 37, ["ev_1"])
    assert c.display == "at least 24 of 37"
    assert c.share == pytest.approx(0.649, abs=1e-3)
    assert c.ci == [0.488, 0.784] or (c.ci[0] == pytest.approx(0.49, abs=0.01) and c.ci[1] == pytest.approx(0.78, abs=0.01))
    assert c.evidence_ids == ["ev_1"]


def test_count_small_n_has_no_share():
    c = make_count(4, 7)
    assert c.share is None and c.ci is None
    assert c.display == "4 of 7 (too few to compare)"


def test_count_thousands_separator():
    assert make_count(1200, 3400).display == "at least 1,200 of 3,400"


def test_fold_small_hides_rows_under_five():
    rows, other = fold_small({"Germany": 12, "India": 30, "Ireland": 4, "Canada": 1, "Netherlands": 5})
    labels = [r[0] for r in rows]
    assert labels == ["India", "Germany", "Netherlands"]
    assert other == 5


def test_fold_small_top_limit_folds_overflow():
    rows, other = fold_small({"a": 10, "b": 9, "c": 8}, top=2)
    assert [r[0] for r in rows] == ["a", "b"] and other == 8


def test_distribution_adds_other_row_and_remainders():
    items, other = distribution({"A": 20, "B": 3, "C": 2}, 30, other_label="Other countries", remainders={"Still in India": 5})
    assert [i["label"] for i in items] == ["A", "Other countries", "Still in India"]
    assert items[1]["count"] == 5 and other == 5
    assert items[0]["share"] == 0.667 and items[2]["remainder"] is True


def test_distribution_target_first_and_no_share_when_small():
    items, _ = distribution({"Germany": 6, "United States": 9}, 9, target="germany")
    assert items[0]["label"] == "Germany" and items[0]["target"] is True
    assert items[0]["share"] is None  # n < 10


def test_median_and_quantile():
    assert median([3, 1, 2]) == 2
    assert median([1, 2, 3, 4]) == 2.5
    assert median([]) is None
    assert median([None, 5]) == 5
    assert quantile([0, 10], 0.5) == 5


def test_confidence_levels():
    assert confidence_level(5) == "low"
    assert confidence_level(50) == "medium"
    assert confidence_level(500) == "high"
    assert confidence_level(500, widened=True) == "medium"
    assert confidence_level(500, sample_n=5) == "low"
