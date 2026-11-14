"""Check the injury analysis against figures Public Health Scotland published.

Usage (from the repository root): uv run python -m atlas.validate [output folder]

Published values come from PHS, "Unintentional Injuries in Scotland. Hospital Admissions: Year
ending 31 March 2024; Deaths: Year ending 31 December 2023", summary, 29 October 2024 (SOURCE_2024).
The competition package comes from the later (2025) release, which can revise earlier years; two
figures from the 2025 release are taken as quoted by RoSPA Scotland (SOURCE_2025), as the PHS page
for that release could not be reached. Writes validation.csv: each published figure, its source,
ours, and the difference.
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path

from .injuries import ESP, events, population
from .stats import dsr

SOURCE_2024 = (
    "PHS unintentional injuries summary, 29 October 2024: "
    "https://publichealthscotland.scot/media/29688/2024-10-29-ui-2024-summary-final.pdf"
)
SOURCE_2025 = (
    "PHS 2025 release as quoted by RoSPA Scotland (cross-party group, 3 June 2025): "
    "https://rspa01mstr2ql5zprod.rospa.com/siteassets/documents/about-us/rospa-scotland/cpg/"
    "x_party_group_3rdjune2025-2-sab-002.pdf"
)
UNDER_15 = ("0-4 years", "5-9 years", "10-14 years")
OVER_65 = ("65-74 years", "75plus years")


def published() -> list[dict]:
    """The figures as published (the 2014/15 road traffic rate is outside the package's years).

    Returns:
        One row per figure: id, description, value and source.
    """
    rows = [
        ("admissions_2023_24", "Emergency admissions, 2023/24", 56294, SOURCE_2024),
        ("deaths_2023", "Deaths, 2023", 2822, SOURCE_2024),
        ("under15_admissions", "Admissions under 15, 2023/24", 5746, SOURCE_2024),
        ("under15_falls_share", "Falls share, under 15, 2023/24 (%)", 42, SOURCE_2024),
        ("over65_admissions", "Admissions 65 and over, 2023/24", 28389, SOURCE_2024),
        ("over65_falls_share", "Falls share, 65 and over, 2023/24 (%)", 86, SOURCE_2024),
        ("rti_u15_2023_24", "Road traffic EASR under 15, 2023/24", 26, SOURCE_2024),
        ("over65_admissions_2024_25", "Admissions 65 and over, 2024/25", 28455, SOURCE_2025),
        ("over65_falls_share_2024_25", "Falls share, 65 and over, 2024/25 (%)", 87, SOURCE_2025),
    ]
    return [{"id": i, "what": w, "value": v, "source": s} for i, w, v, s in rows]


def ours(rows: list[tuple], pop: dict) -> dict[str, float]:
    """The same figures from the competition package.

    Args:
        rows: From `injuries.events`.
        pop: Population by (year, council, sex, age band), from `injuries.population`.

    Returns:
        Value by figure id.
    """

    def total(d: str, label: str, ages=None, injury=None) -> float:
        return sum(
            n
            for d_, lab, _y, _c, _s, a, t, n in rows
            if d_ == d
            and lab == label
            and (ages is None or a in ages)
            and (injury is None or t == injury)
        )

    def rti_u15(label: str, year: int) -> float:
        weight_total = sum(ESP[a] for a in UNDER_15) * 2
        cells = []
        for s in ("Female", "Male"):
            for a in UNDER_15:
                n = sum(
                    v
                    for d_, lab, _y, _c, s_, a_, t, v in rows
                    if d_ == "admissions"
                    and lab == label
                    and s_ == s
                    and a_ == a
                    and t == "Road traffic"
                )
                p = sum(
                    v for (y, _c, s_, a_), v in pop.items() if y == year and s_ == s and a_ == a
                )
                cells.append((n, p, ESP[a] / weight_total))
        return dsr(cells)["rate"]

    u15 = total("admissions", "2023/24", UNDER_15)
    o65 = total("admissions", "2023/24", OVER_65)
    o65_next = total("admissions", "2024/25", OVER_65)
    return {
        "admissions_2023_24": total("admissions", "2023/24"),
        "deaths_2023": total("deaths", "2023"),
        "under15_admissions": u15,
        "under15_falls_share": 100 * total("admissions", "2023/24", UNDER_15, "Falls") / u15,
        "over65_admissions": o65,
        "over65_falls_share": 100 * total("admissions", "2023/24", OVER_65, "Falls") / o65,
        "rti_u15_2023_24": rti_u15("2023/24", 2023),
        "over65_admissions_2024_25": o65_next,
        "over65_falls_share_2024_25": 100
        * total("admissions", "2024/25", OVER_65, "Falls")
        / o65_next,
    }


def main() -> None:
    """Compare and write the table."""
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("results/2026-11-14-validation")
    out.mkdir(parents=True, exist_ok=True)
    pop, _q1 = population()
    mine = ours(events(), pop)
    table = []
    for f in published():
        v = mine[f["id"]]
        table.append(
            f
            | {
                "ours": round(v, 1),
                "difference": round(v - f["value"], 1),
                "difference_pct": round(100 * (v - f["value"]) / f["value"], 2),
            }
        )
    with (out / "validation.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(table[0]))
        w.writeheader()
        w.writerows(table)
    for r in table:
        print(r["what"], r["value"], r["ours"], f"{r['difference_pct']}%")


if __name__ == "__main__":
    main()
