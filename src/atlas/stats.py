"""Statistics shared by the analyses: standardised rates, their intervals, rank correlation."""

from __future__ import annotations

import math

import numpy as np

Z95 = 1.959964


def byar(o: float, z: float = Z95) -> tuple[float, float]:
    """Byar's approximation to the confidence limits of a Poisson count.

    Args:
        o: The observed count.
        z: The normal quantile (1.96 for 95%).

    Returns:
        Lower and upper limit of the count.
    """
    lower = 0.0 if o == 0 else o * (1 - 1 / (9 * o) - z / (3 * math.sqrt(o))) ** 3
    upper = (o + 1) * (1 - 1 / (9 * (o + 1)) + z / (3 * math.sqrt(o + 1))) ** 3
    return lower, upper


def dsr(cells: list[tuple[float, float, float]], per: float = 1e5, z: float = Z95) -> dict:
    """A directly standardised rate with its confidence interval (Dobson et al. 1991).

    Args:
        cells: (events, population, standard weight) for each stratum; weights sum to 1 and every
            population is positive.
        per: Rate multiplier (1e5 gives a rate per 100,000).
        z: The normal quantile (1.96 for 95%).

    Returns:
        events, population, rate, lower and upper limit (rates rounded to 2 decimals).
    """
    o = sum(d for d, _n, _w in cells)
    p = sum(n for _d, n, _w in cells)
    rate = sum(w * d / n for d, n, w in cells)
    var = sum(w * w * d / (n * n) for d, n, w in cells)
    lo_o, hi_o = byar(o, z)
    if o > 0:
        k = math.sqrt(var / o)
        lo, hi = rate + k * (lo_o - o), rate + k * (hi_o - o)
    else:  # no events: the upper limit from the count alone, at the mean weight per person
        lo, hi = 0.0, hi_o * sum(w / n for _d, n, w in cells) / len(cells)
    return {
        "events": int(o),
        "population": round(p),
        "rate": round(per * rate, 2),
        "lower": round(per * max(lo, 0.0), 2),
        "upper": round(per * hi, 2),
    }


def ranks(x: list[float]) -> np.ndarray:
    """Ranks from 1, ties given their average rank.

    Args:
        x: The values.

    Returns:
        The ranks.
    """
    a = np.asarray(x, dtype=float)
    order = np.argsort(a, kind="mergesort")
    r = np.empty(len(a))
    r[order] = np.arange(1, len(a) + 1)
    for v in np.unique(a):  # average the ranks of tied values
        tied = a == v
        r[tied] = r[tied].mean()
    return r


def spearman(x: list[float], y: list[float]) -> float:
    """Spearman's rank correlation, ties handled by average ranks.

    Args:
        x: First variable.
        y: Second variable, the same length.

    Returns:
        rho.
    """
    if len(x) != len(y) or len(x) < 2:
        raise ValueError("spearman needs two sequences of the same length, at least 2")
    return float(np.corrcoef(ranks(x), ranks(y))[0, 1])
