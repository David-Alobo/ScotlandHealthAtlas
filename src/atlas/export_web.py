"""Export the numbers the web story shows, from the saved results tables, to one JSON file.

Usage (from the repository root): uv run python -m atlas.export_web [output file]

Reads only committed tables in results/, never the raw data, so the page can be rebuilt anywhere
and every number on it traces to a table. Writes web/data/story.json by default.
"""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

RESULTS = Path("results")
AE = RESULTS / "2026-11-14-ae-deprivation"
DIST = RESULTS / "2026-11-14-distributions"
INJ = RESULTS / "2026-11-14-injuries"
RX = RESULTS / "2026-11-14-prescribing"
AE_YEAR = 2025  # latest whole calendar year of A&E data
CHAPTERS = 6


def read(path: Path) -> list[dict]:
    """A CSV table as a list of rows.

    Args:
        path: The file.

    Returns:
        The rows, as strings.
    """
    with path.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def hero() -> dict:
    """One number for each dataset, for the opening.

    Returns:
        A&E attendances in a year, injury admissions and deaths in a year, prescription items in
        twelve months, each with its period.
    """
    ae = sum(
        int(r["total"])
        for r in read(DIST / "ae_activity_time.csv")
        if r["period"].startswith(str(AE_YEAR))
    )
    nat = read(INJ / "national.csv")
    adm = [r for r in nat if r["dataset"] == "admissions" and r["injury_type"] == "All types"]
    dth = [r for r in nat if r["dataset"] == "deaths" and r["injury_type"] == "All types"]
    items = sum(int(r["items"]) for r in read(RX / "quintile.csv"))
    return {
        "ae_attendances": {"value": ae, "period": str(AE_YEAR)},
        "injury_admissions": {"value": int(adm[-1]["events"]), "period": adm[-1]["year"]},
        "injury_deaths": {"value": int(dth[-1]["events"]), "period": dth[-1]["year"]},
        "prescription_items": {"value": items, "period": "June 2025 to May 2026"},
    }


def ae_gap() -> dict:
    """A&E attendance rates by quintile over time, and the sensitivity of the gap.

    Returns:
        Years, one series per quintile (standardised per 1,000), and the ratio table.
    """
    rows = [r for r in read(AE / "rates.csv") if r["scope"] == "all"]
    years = sorted({int(r["year"]) for r in rows})
    series = {
        q: [float(r["standardised_per_1000"]) for r in rows if int(r["simd_quintile"]) == q]
        for q in range(1, 6)
    }
    sens = read(AE / "gap_sensitivity.csv")
    return {
        "years": years,
        "quintiles": [{"quintile": q, "rate": series[q]} for q in range(1, 6)],
        "ratio": [
            {
                "year": int(r["year"]),
                "published": float(r["ratio_as_published"]),
                "excess_to_q1": float(r["ratio_excess_unknown_to_q1"]),
                "all_to_q5": float(r["ratio_all_unknown_to_q5"]),
            }
            for r in sens
        ],
    }


def injury_ages() -> dict:
    """Falls and poisoning a year by age band, deaths and admissions (sexes together).

    Returns:
        Age bands, periods, and per-year counts for each dataset and type.
    """
    rows = read(INJ / "age_profile.csv")
    bands = list(dict.fromkeys(r["age_band"] for r in rows))
    out: dict = {"bands": [b.replace(" years", "").replace("75plus", "75+") for b in bands]}
    for d in ("deaths", "admissions"):
        sub = [r for r in rows if r["dataset"] == d]
        out[d] = {
            "period": sub[0]["period"],
            **{
                t.lower(): [
                    round(
                        sum(
                            float(r["per_year"])
                            for r in sub
                            if r["injury_type"] == t and r["age_band"] == b
                        )
                    )
                    for b in bands
                ]
                for t in ("Falls", "Poisoning")
            },
        }
        for t in ("Falls", "Poisoning"):
            tot = sum(float(r["per_year"]) for r in sub if r["injury_type"] == t)
            men = sum(
                float(r["per_year"]) for r in sub if r["injury_type"] == t and r["sex"] == "Male"
            )
            out[d][f"{t.lower()}_male_share"] = round(men / tot, 3)
            # the total from unrounded values (summing the rounded bands can be off by one)
            out[d][f"{t.lower()}_total"] = round(tot)
    return out


def councils() -> dict:
    """Poisoning death rates by council with intervals, and the deprivation correlations.

    Returns:
        Period, Scotland rate, councils (rate, interval, quintile-1 share, against Scotland) and
        Spearman's rho for poisoning deaths and falls admissions.
    """
    rows = [
        r
        for r in read(INJ / "council.csv")
        if r["dataset"] == "deaths" and r["injury_type"] == "Poisoning"
    ]
    eco = {
        (r["dataset"], r["injury_type"]): float(r["spearman_rho"])
        for r in read(INJ / "ecological.csv")
    }
    return {
        "period": rows[0]["period"],
        "scotland": float(rows[0]["scotland_rate"]),
        "councils": [
            {
                "council": r["council"],
                "rate": float(r["rate"]),
                "lower": float(r["lower"]),
                "upper": float(r["upper"]),
                "share_q1": float(r["share_simd_q1"]),
                "vs": r["vs_scotland"],
            }
            for r in rows
        ],
        "rho_poisoning_deaths": eco[("deaths", "Poisoning")],
        "rho_falls_admissions": eco[("admissions", "Falls")],
    }


def medicines() -> dict:
    """The medicine mix in the most and least deprived fifth.

    Returns:
        The largest chapters with their share of items in quintile 1 and quintile 5.
    """
    rows = read(RX / "chapters.csv")[:CHAPTERS]
    unplaced = next(r for r in read(RX / "quintile.csv") if r["simd_quintile"] == "unplaced")
    return {
        "period": "June 2025 to May 2026",
        "unplaced_share": float(unplaced["share_of_items"]),
        "chapters": [
            {"chapter": r["chapter"], "q1": float(r["share_q1"]), "q5": float(r["share_q5"])}
            for r in rows
        ],
    }


def story() -> dict:
    """Everything the page needs.

    Returns:
        The story data.
    """
    return {
        "hero": hero(),
        "ae": ae_gap(),
        "injury_ages": injury_ages(),
        "councils": councils(),
        "medicines": medicines(),
        "source": "Public Health Scotland (Data Lab competition package, 2026); NRS small area "
        "population estimates; SIMD 2020v2. Analysis: Monstrous Data.",
    }


def main() -> None:
    """Write the JSON file."""
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("web/data/story.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(story(), indent=1) + "\n", encoding="utf-8")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
