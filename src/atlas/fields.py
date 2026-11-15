"""Two fields of the competition data not used elsewhere: where injuries happen, medicine cost.

Usage (from the repository root): uv run python -m atlas.fields [output folder]

Where injuries happened: deaths and emergency admissions after falls and poisoning by the place
recorded (InjuryLocation), over the latest five years of each file; a place is often not
specified, so shares are given of all events and of those with a place recorded.

What medicines cost: gross ingredient cost per item dispensed, by the SIMD 2020v2 quintile of the
dispensing location (placed as in atlas.prescribing) and by medicine chapter, over the latest
twelve whole months; cost is of the medicine, not of dispensing, and is recorded where medicines
are dispensed, not where patients live.

Writes location.csv and cost.csv to the output folder.
"""

from __future__ import annotations

import csv
import sys
from collections import defaultdict
from pathlib import Path

import duckdb

from .distributions import label_of
from .population import lookup
from .prescribing import FILES, PERIOD, postcode_key, postcode_zones

INJURIES = "data/raw/data-viz-2026/data/Unintentional_Injuries"
TYPES = {"Falls": "Falls", "Poisoning": "Poisoning"}
UNKNOWN = {"Unspecified place", "Not applicable", "Not Applicable", "Undisclosed"}


def write(rows: list[dict], path: Path) -> None:
    """Write rows of dicts to a CSV file."""
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)


def locations(con: duckdb.DuckDBPyConnection) -> list[dict]:
    """Falls and poisoning by recorded place, deaths and admissions, latest five years.

    Args:
        con: A DuckDB connection.

    Returns:
        One row per dataset, injury type and place: events, share of all, share of those placed.
    """
    out = []
    for dataset in ("Deaths", "Admissions"):
        src = f"read_csv('{INJURIES}/{dataset}.csv', header=true, sample_size=-1)"
        years = [
            y for (y,) in con.execute(f"SELECT DISTINCT Year FROM {src} ORDER BY 1").fetchall()
        ]
        latest = [str(y) for y in years[-5:]]
        rows = con.execute(
            f"""SELECT InjuryType, InjuryLocation, sum(Number) FROM {src}
                WHERE CAST(Year AS VARCHAR) IN ({", ".join(f"'{y}'" for y in latest)})
                  AND InjuryType IN ('Falls', 'Poisoning')
                GROUP BY ALL"""
        ).fetchall()
        for t in TYPES:
            mine = [(loc, n) for typ, loc, n in rows if typ == t]
            total = sum(n for _, n in mine)
            placed = sum(n for loc, n in mine if loc not in UNKNOWN)
            for loc, n in sorted(mine, key=lambda x: -x[1]):
                out.append({
                    "dataset": dataset.lower(), "years": f"{latest[0]} to {latest[-1]}",
                    "injury_type": t, "location": loc, "events": int(n),
                    "share_of_all": round(n / total, 4),
                    "share_of_placed": "" if loc in UNKNOWN else round(n / placed, 4),
                })  # fmt: skip
    return out


def cost(con: duckdb.DuckDBPyConnection) -> list[dict]:
    """Gross ingredient cost per item by quintile of the dispensing location, and by chapter.

    Args:
        con: A DuckDB connection.

    Returns:
        One row per quintile (chapter "All") and per quintile and chapter.
    """
    zones, dz = postcode_zones(), lookup()
    src = f"read_csv('{FILES}', union_by_name=true, header=true, sample_size=-1)"
    place = {
        code: dz.get(zones.get(postcode_key(pc)), {}).get("quintile")
        for code, pc in con.execute(
            f"""SELECT DispLocationCode, arg_max(upper(trim(DispLocationPostcode)), PaidDateMonth)
                FROM {src} WHERE DispLocationPostcode IS NOT NULL GROUP BY 1"""
        ).fetchall()
    }
    rows = con.execute(
        f"""SELECT DispLocationCode, "Chapter Description", sum(NumberOfPaidItems),
                   sum(GrossIngredientCost)
            FROM {src} WHERE PaidDateMonth BETWEEN {PERIOD[0]} AND {PERIOD[1]} GROUP BY ALL"""
    ).fetchall()
    items: dict = defaultdict(float)
    pounds: dict = defaultdict(float)
    for code, chapter, n, c in rows:
        q = place.get(code)
        for key in ((q, "All"), (q, label_of(str(chapter)))):
            items[key] += n
            pounds[key] += c
    out = []
    for q, chapter in sorted(items, key=lambda k: (str(k[0]), k[1] != "All", k[1])):
        out.append({
            "simd_quintile": q if q else "unplaced", "chapter": chapter,
            "items": int(items[(q, chapter)]),
            "gross_ingredient_cost": round(pounds[(q, chapter)], 2),
            "cost_per_item": round(pounds[(q, chapter)] / items[(q, chapter)], 2),
        })  # fmt: skip
    return out


def main() -> None:
    """Write both tables and print the headline rows."""
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("results/2026-11-15-fields")
    out.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()
    loc = locations(con)
    write(loc, out / "location.csv")
    c = cost(con)
    write(c, out / "cost.csv")
    for r in loc:
        if r["share_of_all"] >= 0.05:
            print(r)
    for r in c:
        if r["chapter"] == "All":
            print(r)


if __name__ == "__main__":
    main()
