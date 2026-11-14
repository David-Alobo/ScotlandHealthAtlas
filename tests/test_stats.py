import math

import pytest

from atlas.stats import byar, dsr, ranks, spearman


def test_byar_close_to_exact_poisson_limits():
    # exact 95% Poisson limits for 10 events: 4.795 and 18.390
    lo, hi = byar(10)
    assert lo == pytest.approx(4.795, abs=0.02)
    assert hi == pytest.approx(18.390, abs=0.02)


def test_byar_zero_events_has_lower_limit_zero():
    lo, hi = byar(0)
    assert lo == 0.0
    assert hi == pytest.approx(3.689, abs=0.05)  # exact: 3.689


def test_dsr_single_stratum_is_the_crude_rate():
    r = dsr([(50, 10_000, 1.0)])
    assert r["rate"] == pytest.approx(500.0)
    assert r["events"] == 50 and r["population"] == 10_000
    # one stratum: the interval is the count's Byar interval, scaled
    lo, hi = byar(50)
    assert r["lower"] == pytest.approx(round(1e5 * lo / 10_000, 2))
    assert r["upper"] == pytest.approx(round(1e5 * hi / 10_000, 2))


def test_dsr_weights_the_stratum_rates():
    # rates 0.001 and 0.003 per person, weighted 3:1 -> 0.0015 -> 150 per 100,000
    r = dsr([(10, 10_000, 0.75), (30, 10_000, 0.25)])
    assert r["rate"] == pytest.approx(150.0)
    assert r["lower"] < 150.0 < r["upper"]


def test_dsr_is_independent_of_stratum_order():
    cells = [(3, 1_000, 0.2), (40, 5_000, 0.5), (7, 2_000, 0.3)]
    assert dsr(cells) == dsr(cells[::-1])


def test_dsr_zero_events_gives_zero_rate_and_positive_upper():
    r = dsr([(0, 1_000, 0.5), (0, 3_000, 0.5)])
    assert r["rate"] == 0.0 and r["lower"] == 0.0 and r["upper"] > 0


def test_ranks_average_ties():
    assert list(ranks([10, 20, 20, 30])) == [1, 2.5, 2.5, 4]


def test_spearman_monotone_and_reversed():
    assert spearman([1, 2, 3, 4], [2, 4, 8, 16]) == pytest.approx(1.0)
    assert spearman([1, 2, 3, 4], [9, 7, 5, 1]) == pytest.approx(-1.0)


def test_spearman_with_ties_matches_hand_value():
    # ranks (1, 2.5, 2.5, 4) and (1, 2, 3, 4): r = 4.5 / sqrt(4.5 * 5)
    assert spearman([1, 2, 2, 3], [1, 2, 3, 4]) == pytest.approx(4.5 / math.sqrt(22.5))


def test_spearman_rejects_unequal_lengths():
    with pytest.raises(ValueError):
        spearman([1, 2, 3], [1, 2])
