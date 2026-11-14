"""A&E attendance rates by deprivation of where people live, Scotland, 2018 to 2025.

Usage (from the repository root): python -m src.atlas.ae_deprivation [output folder]

For each calendar year and SIMD 2020v2 quintile: attendances (Type 1 and 3 together, and Type 1
emergency departments alone), the population, the crude rate per 1,000 people, and the rate
standardised by age and sex to Scotland's mid-2024 population (direct standardisation, in the
A&E file's six age bands); 2025 uses the mid-2024 population, the latest. Rates are national: attendances are counted wherever people went, so
quintile totals are not affected by people attending a hospital in another board. Attendances
with unknown deprivation, age or sex are counted in the totals and reported, not spread across
quintiles. Writes rates.csv, gap.csv and rates.png to the output folder.
"""

from __future__ import annotations

import csv
import sys
from collections import defaultdict
from pathlib import Path

import duckdb

AE = "data/raw/data-viz-2026/data/A&E/Level_2_Demographics.csv"
POP = Path("data/derived/population_ae.csv")
YEARS = range(2018, 2026)  # whole calendar years in the file
STANDARD_YEAR = 2024
LATEST_POPULATION = 2024  # later years use the latest estimates, flagged


def population() -> dict[tuple, float]:
    """Population by (year, quintile, sex, age band), summed over boards and councils.

    Returns:
        The populations.
    """
    pop: dict[tuple, float] = defaultdict(float)
    with POP.open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            pop[(int(r["year"]), int(r["simd_quintile"]), r["sex"], r["age_band"])] += float(
                r["population"]
            )
    return pop


def main() -> None:
    """Compute the rates and the gap, and draw the chart."""
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("results/2026-11-14-ae-deprivation")
    out.mkdir(parents=True, exist_ok=True)
    pop = population()
    con = duckdb.connect()
    rows = con.execute(
        f"""SELECT Month // 100 AS year, DepartmentType, Deprivation, Sex, Age,
                   sum(NumberOfAttendances)
            FROM read_csv('{AE}', header=true, sample_size=-1)
            WHERE Month // 100 BETWEEN {YEARS[0]} AND {YEARS[-1]}
            GROUP BY ALL"""
    ).fetchall()
    # standard population: Scotland, mid-2024, by sex and age band
    standard: dict[tuple, float] = defaultdict(float)
    for (y, _q, sex, age), n in pop.items():
        if y == STANDARD_YEAR:
            standard[(sex, age)] += n
    std_total = sum(standard.values())

    results, unknown = [], defaultdict(float)
    for scope, types in (("all", ("Type 1", "Type 3")), ("type1", ("Type 1",))):
        counts: dict[tuple, float] = defaultdict(float)
        for year, dtype, dep, sex, age, n in rows:
            if dtype not in types:
                continue
            if dep is None or sex is None or age is None:
                unknown[(scope, year)] += n
                continue
            counts[(year, int(dep), sex, age)] += n
        for year in YEARS:
            py = min(year, LATEST_POPULATION)
            for q in range(1, 6):
                att = sum(v for (y, d, _s, _a), v in counts.items() if y == year and d == q)
                p = sum(v for (y, d, _s, _a), v in pop.items() if y == py and d == q)
                std = sum(
                    counts.get((year, q, sex, age), 0.0)
                    / pop[(py, q, sex, age)]
                    * standard[(sex, age)]
                    for (sex, age) in standard
                ) / std_total
                results.append(
                    {
                        "scope": scope,
                        "year": year,
                        "simd_quintile": q,
                        "attendances": int(att),
                        "population": round(p),
                        "crude_per_1000": round(1000 * att / p, 2),
                        "standardised_per_1000": round(1000 * std, 2),
                        "population_estimated": int(year == 2022 or year > LATEST_POPULATION),
                    }
                )
    with (out / "rates.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(results[0]))
        w.writeheader()
        w.writerows(results)

    gap = []
    for scope in ("all", "type1"):
        for year in YEARS:
            by_q = {r["simd_quintile"]: r for r in results if r["scope"] == scope and r["year"] == year}
            total = sum(r["attendances"] for r in by_q.values()) + unknown[(scope, year)]
            gap.append(
                {
                    "scope": scope,
                    "year": year,
                    "q1_standardised": by_q[1]["standardised_per_1000"],
                    "q5_standardised": by_q[5]["standardised_per_1000"],
                    "ratio_q1_q5": round(by_q[1]["standardised_per_1000"]
                                         / by_q[5]["standardised_per_1000"], 3),
                    "difference_per_1000": round(by_q[1]["standardised_per_1000"]
                                                 - by_q[5]["standardised_per_1000"], 2),
                    "unknown_share": round(unknown[(scope, year)] / total, 4),
                }
            )
    with (out / "gap.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(gap[0]))
        w.writeheader()
        w.writerows(gap)
    chart(results, out / "rates.png")
    for g in gap:
        print(g)


def chart(results: list[dict], path: Path) -> None:
    """Standardised rates by quintile over time, one line each, labelled at the end.

    Args:
        results: The rate rows.
        path: Where to save the PNG.
    """
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    # one hue, dark for the most deprived (an ordered scale, not categories)
    shades = {1: "#08306b", 2: "#2171b5", 3: "#6baed6", 4: "#a8cbe6", 5: "#cfdff0"}
    names = {1: "1 most deprived", 2: "2", 3: "3", 4: "4", 5: "5 least deprived"}
    fig, ax = plt.subplots(figsize=(8, 4.6), dpi=150)
    for q in range(1, 6):
        pts = [r for r in results if r["scope"] == "all" and r["simd_quintile"] == q]
        xs = [r["year"] for r in pts]
        ys = [r["standardised_per_1000"] for r in pts]
        ax.plot(xs, ys, color=shades[q], linewidth=2, marker="o", markersize=4)
        ax.annotate(names[q], (xs[-1], ys[-1]), xytext=(6, 0), textcoords="offset points",
                    va="center", fontsize=8, color="#333333")
    fig.text(0.01, 0.965, "A&E attendances per 1,000 people, by deprivation of where they live",
             fontsize=11, color="#222222", va="top")
    fig.text(0.01, 0.915, "Scotland, all A&E sites; standardised for age and sex to the 2024 "
             "population", fontsize=8, color="#555555", va="top")
    ax.set_xlim(2017.7, 2026.3)
    ax.set_xticks(list(YEARS))
    ax.set_ylim(bottom=0)
    ax.grid(axis="y", color="#e5e5e5", linewidth=0.8)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    ax.tick_params(colors="#555555", labelsize=8)
    fig.text(0.01, 0.01, "Data: Public Health Scotland; NRS population estimates; SIMD 2020v2. "
             "2022 population interpolated; 2025 uses mid-2024.", fontsize=6.5, color="#777777")
    fig.tight_layout(rect=(0, 0.03, 1, 0.89))
    fig.savefig(path)


if __name__ == "__main__":
    main()
