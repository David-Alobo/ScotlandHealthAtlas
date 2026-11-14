import pytest

from atlas.ae_deprivation import YEARS, sensitivity, standardised

STRATA = [("Female", "0-17"), ("Male", "0-17"), ("Female", "65+"), ("Male", "65+")]


def _pop():
    return {
        (y, q, s, a): 1000.0 * (1 + (a == "0-17"))
        for y in range(YEARS[0], YEARS[-1] + 1)
        for q in range(1, 6)
        for s, a in STRATA
    }


def test_standardised_equals_crude_when_population_is_the_standard():
    pop = _pop()
    standard = {(s, a): pop[(2020, 1, s, a)] for s, a in STRATA}
    counts = {(2020, 1, s, a): 10.0 * (i + 1) for i, (s, a) in enumerate(STRATA)}
    crude = sum(counts.values()) / sum(standard.values())
    assert standardised(counts, pop, standard, 2020, 1) == pytest.approx(crude)


def test_sensitivity_scenarios_are_ordered():
    pop = _pop()
    standard = {(s, a): 1.0 for s, a in STRATA}
    rows = []
    for y in YEARS:
        for s, a in STRATA:
            rows.append((y, "Type 1", 1, s, a, 200))  # most deprived attend twice as often
            rows.append((y, "Type 1", 5, s, a, 100))
            rows.append((y, "Type 1", None, s, a, 5 + (y - YEARS[0])))  # unknowns grow
            rows.append((y, "Type 1", 3, None, a, 50))  # no sex: left out
    out = sensitivity(rows, pop, standard)
    assert [r["year"] for r in out] == list(YEARS)
    for r in out:
        assert r["ratio_as_published"] == pytest.approx(2.0)
        assert r["ratio_all_unknown_to_q5"] < r["ratio_as_published"]
        assert r["ratio_as_published"] <= r["ratio_excess_unknown_to_q1"]
        assert r["ratio_excess_unknown_to_q1"] <= r["ratio_all_unknown_to_q1"]
