"""Unintentional injury admissions and deaths: rates over time, by council area, and by deprivation.

Usage (from the repository root): python -m src.atlas.injuries [output folder]

Rates are per 100,000 people, standardised for age and sex to the 2013 European Standard
Population (ESP2013, the standard PHS uses for these statistics), with its 5-year bands summed to
the injury files' eight age bands, each sex weighted equally. 95% confidence intervals use the
Dobson method with Byar's approximation for the count. A financial year (admissions) takes the
mid-year population of the year it starts in, a calendar year (deaths) its own year; 2024/25 and
2024 use mid-2024, the latest.

The injury files carry no deprivation, so deprivation is compared between areas only: each
council's rate against the share of its people living in the most deprived fifth of Scotland's
data zones (SIMD 2020v2 quintile 1). This is an ecological comparison: it says how areas differ,
not that more deprived people are injured more.

Council rates pool the latest five years, as single years hold small counts (most rows of the
files are zero). Writes national.csv, age_falls.csv, council.csv, ecological.csv and the figures
national, councils and ecological (PDF, SVG, PNG) to the output folder.
"""

from __future__ import annotations

import csv
import math
import sys
from collections import defaultdict
from pathlib import Path

import duckdb
import numpy as np

DATA = "data/raw/data-viz-2026/data/Unintentional_Injuries"
POP = Path("data/derived/population_injury.csv")
LATEST_POPULATION = 2024
POOLED = 5  # latest years pooled for council rates
Z = 1.959964

# ESP2013 5-year bands summed to the injury files' age bands (total 100,000)
ESP = {
    "0-4 years": 5000,
    "5-9 years": 5500,
    "10-14 years": 5500,
    "15-24 years": 11500,
    "25-44 years": 26500,
    "45-64 years": 26500,
    "65-74 years": 10500,
    "75plus years": 9000,
}
TYPE_NAMES = {"RTI": "Road traffic", "Land transport accidents": "Road traffic",
              "Struck by, against": "Struck by or against"}
FOCUS = {"admissions": "Falls", "deaths": "Poisoning"}  # the largest cause of each


def population() -> tuple[dict[tuple, float], dict[str, float]]:
    """Population by (year, council, sex, age band), and each council's share in SIMD quintile 1.

    Returns:
        The populations, and the quintile-1 shares (mid-2024).
    """
    pop: dict[tuple, float] = defaultdict(float)
    q1: dict[str, float] = defaultdict(float)
    total: dict[str, float] = defaultdict(float)
    with POP.open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            year, n = int(r["year"]), float(r["population"])
            pop[(year, r["council"], r["sex"], r["age_band"])] += n
            if year == LATEST_POPULATION:
                total[r["council"]] += n
                if r["simd_quintile"] == "1":
                    q1[r["council"]] += n
    return pop, {c: q1[c] / total[c] for c in total}


def events() -> list[tuple]:
    """Counts from both files, summed over places.

    Returns:
        Rows of (dataset, year label, start year, council, sex, age band, injury type, number).
    """
    con = duckdb.connect()
    rows = []
    for dataset in ("Admissions", "Deaths"):
        rows += con.execute(
            f"""SELECT lower(Dataset), CAST(Year AS VARCHAR), CAName, Sex, AgeGroup, InjuryType,
                       sum(Number)
                FROM read_csv('{DATA}/{dataset}.csv', header=true, sample_size=-1)
                GROUP BY ALL"""
        ).fetchall()
    return [(d, y, int(y[:4]), c, s, a, TYPE_NAMES.get(t, t), n) for d, y, c, s, a, t, n in rows]


def dsr(cells: list[tuple[float, float, float]]) -> dict:
    """A directly standardised rate per 100,000 with its 95% confidence interval.

    Args:
        cells: (events, population, standard weight) for each age-sex cell; weights sum to 1.

    Returns:
        events, population, rate, lower and upper limit.
    """
    o = sum(d for d, _n, _w in cells)
    p = sum(n for _d, n, _w in cells)
    rate = sum(w * d / n for d, n, w in cells)
    var = sum(w * w * d / (n * n) for d, n, w in cells)
    lo_o = 0.0 if o == 0 else o * (1 - 1 / (9 * o) - Z / (3 * math.sqrt(o))) ** 3
    hi_o = (o + 1) * (1 - 1 / (9 * (o + 1)) + Z / (3 * math.sqrt(o + 1))) ** 3
    if o > 0:
        k = math.sqrt(var / o)
        lo, hi = rate + k * (lo_o - o), rate + k * (hi_o - o)
    else:  # no events: the upper limit from the count alone, at the mean weight per person
        lo, hi = 0.0, hi_o * sum(w / n for _d, n, w in cells) / len(cells)
    return {"events": int(o), "population": round(p), "rate": round(1e5 * rate, 2),
            "lower": round(1e5 * max(lo, 0.0), 2), "upper": round(1e5 * hi, 2)}


def spearman(x: list[float], y: list[float]) -> float:
    """Spearman's rank correlation (no ties expected in rates and shares).

    Args:
        x: First variable.
        y: Second variable.

    Returns:
        rho.
    """
    rx, ry = np.argsort(np.argsort(x)), np.argsort(np.argsort(y))
    return float(np.corrcoef(rx, ry)[0, 1])


def main() -> None:
    """Compute the rates, write the tables and draw the figures."""
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("results/2026-11-14-injuries")
    out.mkdir(parents=True, exist_ok=True)
    pop, q1_share = population()
    rows = events()
    weight = {(s, a): w / 200000 for a, w in ESP.items() for s in ("Female", "Male")}
    counts: dict[tuple, float] = defaultdict(float)
    labels: dict[tuple, str] = {}
    for d, label, y, c, s, a, t, n in rows:
        for t_ in (t, "All types"):
            counts[(d, y, c, s, a, t_)] += n
        labels[(d, y)] = label
    councils = sorted({r[3] for r in rows})
    types = sorted({r[6] for r in rows}) + ["All types"]

    def rate(d: str, years: list[int], places: list[str], t: str) -> dict:
        cells = [
            (sum(counts.get((d, y, c, s, a, t), 0.0) for y in years for c in places),
             sum(pop[(min(y, LATEST_POPULATION), c, s, a)] for y in years for c in places), w)
            for (s, a), w in weight.items()
        ]
        return dsr(cells)

    national, age_falls, council, eco = [], [], [], []
    for d in ("admissions", "deaths"):
        years = sorted({y for (d_, y) in labels if d_ == d})
        for y in years:
            for t in types:
                national.append({"dataset": d, "year": labels[(d, y)], "injury_type": t}
                                | rate(d, [y], councils, t))
            for a in ESP:  # age-specific falls rates, sexes together
                n = sum(counts.get((d, y, c, s, a, "Falls"), 0.0) for c in councils
                        for s in ("Female", "Male"))
                p = sum(pop[(min(y, LATEST_POPULATION), c, s, a)] for c in councils
                        for s in ("Female", "Male"))
                age_falls.append({"dataset": d, "year": labels[(d, y)], "age_band": a,
                                  "falls": int(n), "population": round(p),
                                  "rate_per_100000": round(1e5 * n / p, 2)})
        pooled = years[-POOLED:]
        period = f"{labels[(d, pooled[0])]} to {labels[(d, pooled[-1])]}"
        for t in (FOCUS[d], "All types"):
            scot = rate(d, pooled, councils, t)
            by = {c: rate(d, pooled, [c], t) for c in councils}
            for c in councils:
                r = by[c]
                vs = ("above" if r["lower"] > scot["rate"] else
                      "below" if r["upper"] < scot["rate"] else "similar")
                council.append({"dataset": d, "period": period, "injury_type": t, "council": c}
                               | r | {"scotland_rate": scot["rate"], "vs_scotland": vs,
                                      "share_simd_q1": round(q1_share[c], 4)})
            rho = spearman([by[c]["rate"] for c in councils], [q1_share[c] for c in councils])
            eco.append({"dataset": d, "period": period, "injury_type": t,
                        "councils": len(councils), "spearman_rho": round(rho, 3)})

    for name, table in (("national", national), ("age_falls", age_falls),
                        ("council", council), ("ecological", eco)):
        with (out / f"{name}.csv").open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(table[0]))
            w.writeheader()
            w.writerows(table)
    chart_national(national, age_falls, out / "national")
    chart_councils(council, out / "councils")
    chart_ecological(council, eco, out / "ecological")
    for e in eco:
        print(e)


def chart_national(national: list[dict], age_falls: list[dict], stem: Path) -> None:
    """(a) admissions and (b) deaths by injury type over time; (c) falls admissions by age.

    Args:
        national: The national rate rows.
        age_falls: The age-specific falls rows.
        stem: Where to save, without extension.
    """
    import matplotlib.pyplot as plt

    from . import style

    style.use()
    fig = plt.figure(figsize=(style.DOUBLE, 118 * style.MM))
    gs = fig.add_gridspec(2, 2, height_ratios=[1, 1], hspace=0.7, wspace=0.6)
    for i, (d, title) in enumerate((("admissions", "Emergency admissions"),
                                    ("deaths", "Deaths"))):
        ax = fig.add_subplot(gs[0, i])
        rows = [r for r in national if r["dataset"] == d and r["injury_type"] != "All types"]
        years = sorted({r["year"] for r in rows})
        last = {r["injury_type"]: r["rate"] for r in rows if r["year"] == years[-1]}
        order = sorted(last, key=lambda t: -last[t])
        shown = order[:3]
        series = {t: {r["year"]: r["rate"] for r in rows if r["injury_type"] == t} for t in shown}
        rest = defaultdict(float)  # standardised rates add up over types
        for r in rows:
            if r["injury_type"] not in shown:
                rest[r["year"]] += r["rate"]
        series[f"{len(order) - 3} others"] = rest
        ends = []
        for j, (t, s) in enumerate(series.items()):
            ys = [s[y] for y in years]
            ax.plot(range(len(years)), ys, color=style.CATEGORICAL[j], marker="o")
            ends.append((t, len(years) - 1, ys[-1]))
        step = 1 if len(years) <= 6 else 3
        ax.set_xticks(range(0, len(years), step), years[::step])
        ax.set_xlim(-0.4, len(years) - 0.6)
        ax.set_ylim(bottom=0)
        ax.set_ylabel("Per 100,000 people\n(age-sex standardised)")
        style.label_ends(ax, ends)
        ax.set_title(f"{title}, Scotland")
        style.panel(ax, "ab"[i])

    ax = fig.add_subplot(gs[1, :])
    rows = [r for r in age_falls if r["dataset"] == "admissions"]
    years = sorted({r["year"] for r in rows})
    groups = [("75 and over", ["75plus years"]), ("65-74", ["65-74 years"]),
              ("Under 65", [a for a in ESP if a not in ("65-74 years", "75plus years")])]
    ends = []
    for j, (name, bands) in enumerate(groups):
        ys = []
        for y in years:
            sel = [r for r in rows if r["year"] == y and r["age_band"] in bands]
            ys.append(1e5 * sum(r["falls"] for r in sel) / sum(r["population"] for r in sel))
        ax.plot(range(len(years)), ys, color=style.CATEGORICAL[j], marker="o")
        ends.append((name, len(years) - 1, ys[-1]))
    ax.set_xticks(range(len(years)), years)
    ax.set_xlim(-0.4, len(years) - 0.6)
    ax.set_ylim(0, 4400)
    ax.yaxis.set_major_formatter(style.thousands())
    ax.set_ylabel("Falls admissions\nper 100,000 people")
    style.label_ends(ax, ends)
    ax.set_title("Emergency admissions after a fall, by age")
    style.panel(ax, "c")
    style.source(fig, style.SOURCE_PHS + "; NRS small area population estimates. Rates "
                 "standardised to the 2013 European Standard Population; panel c is age-specific "
                 "(not standardised); '4 others': the remaining injury types together. Financial "
                 "years start in April.")
    style.save(fig, stem)


def chart_councils(council: list[dict], stem: Path) -> None:
    """Council rates with 95% intervals against Scotland: falls admissions and poisoning deaths.

    Args:
        council: The council rate rows.
        stem: Where to save, without extension.
    """
    import matplotlib.pyplot as plt

    from . import style

    style.use()
    colour = {"above": style.CATEGORICAL[1], "below": style.CATEGORICAL[0],
              "similar": "#a8a7a2"}
    fig, axes = plt.subplots(1, 2, figsize=(style.DOUBLE, 150 * style.MM))
    fig.subplots_adjust(wspace=0.95)
    for i, (ax, d) in enumerate(zip(axes, ("admissions", "deaths"), strict=True)):
        t = FOCUS[d]
        rows = sorted((r for r in council if r["dataset"] == d and r["injury_type"] == t),
                      key=lambda r: r["rate"])
        y = np.arange(len(rows))
        for yy, r in zip(y, rows, strict=True):
            ax.plot([r["lower"], r["upper"]], [yy, yy], color=colour[r["vs_scotland"]], lw=1.0,
                    solid_capstyle="butt")
            ax.plot(r["rate"], yy, "o", color=colour[r["vs_scotland"]], ms=3.2)
        scot = rows[0]["scotland_rate"]
        ax.axvline(scot, color=style.INK_3, lw=0.6, ls=(0, (2, 2)), zorder=0)
        ax.text(scot, len(rows) - 0.2, f"Scotland {scot:.0f}", fontsize=6.5, color=style.INK_2,
                ha="center", va="bottom")
        ax.set_yticks(y, [r["council"] for r in rows])
        ax.tick_params(axis="y", labelsize=6.5, length=0)
        ax.set_ylim(-0.7, len(rows) + 0.6)
        ax.set_xlim(left=0)
        ax.set_xlabel("Per 100,000 people a year\n(age-sex standardised, 95% interval)")
        what = "Emergency admissions after a fall" if d == "admissions" else "Deaths from poisoning"
        ax.set_title(f"{what}\n{rows[0]['period']}", fontsize=8)
        style.panel(ax, "ab"[i])
    style.source(fig, style.SOURCE_PHS + "; NRS small area population estimates. Orange: interval "
                 "above the Scotland rate; blue: below; grey: overlaps it. Standardised to the "
                 "2013 European Standard Population; five years pooled.")
    style.save(fig, stem)


def chart_ecological(council: list[dict], eco: list[dict], stem: Path) -> None:
    """Council rates against the share of people in the most deprived fifth of data zones.

    Args:
        council: The council rate rows.
        eco: The correlations.
        stem: Where to save, without extension.
    """
    import matplotlib.pyplot as plt

    from . import style

    style.use()
    fig, axes = plt.subplots(1, 2, figsize=(style.DOUBLE, 80 * style.MM))
    fig.subplots_adjust(wspace=0.4, bottom=0.21)
    for i, (ax, d) in enumerate(zip(axes, ("admissions", "deaths"), strict=True)):
        t = FOCUS[d]
        rows = [r for r in council if r["dataset"] == d and r["injury_type"] == t]
        xs = [100 * r["share_simd_q1"] for r in rows]
        ys = [r["rate"] for r in rows]
        ax.scatter(xs, ys, s=14, color=style.CATEGORICAL[0], edgecolor="white", linewidth=0.5,
                   zorder=3)
        rho = next(e["spearman_rho"] for e in eco if e["dataset"] == d and e["injury_type"] == t)
        ax.text(0.03, 0.97, f"Spearman ρ = {rho:.2f} (32 council areas)",
                transform=ax.transAxes, fontsize=6.5, color=style.INK_2, va="top")
        top = sorted(rows, key=lambda r: -r["rate"])[:3]
        for r in top + sorted(rows, key=lambda r: -r["share_simd_q1"])[:2]:
            ax.annotate(r["council"], (100 * r["share_simd_q1"], r["rate"]), xytext=(4, 0),
                        textcoords="offset points", fontsize=6, color=style.INK_2, va="center")
        ax.set_xlim(-1.5, 50)
        ax.set_ylim(0, max(ys) * 1.08)
        ax.set_xlabel("People living in the most deprived fifth\nof Scotland's data zones (%)")
        ax.set_ylabel("Per 100,000 people a year\n(age-sex standardised)")
        what = "Falls admissions" if d == "admissions" else "Poisoning deaths"
        ax.set_title(f"{what}, {rows[0]['period']}", fontsize=8)
        style.panel(ax, "ab"[i])
    style.source(fig, style.SOURCE_PHS + "; NRS small area population estimates; SIMD 2020v2 "
                 "(mid-2024 population). Areas compared, not people: an ecological comparison.")
    style.save(fig, stem)


if __name__ == "__main__":
    main()
