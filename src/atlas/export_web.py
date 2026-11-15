"""Export the numbers the web story shows, from the saved results tables, to one JSON file.

Usage (from the repository root): uv run python -m atlas.export_web [output file]

Reads only committed tables (results/ and the data zone look-up in data/derived/ written by
atlas.geo), never the raw data, so the page can be rebuilt anywhere and every number on it traces
to a table. Writes web/data/story.json by default.
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
ACCESS = RESULTS / "2026-11-15-access"
LOOKUP = Path("data/derived/dz_lookup.csv")  # data zone, SIMD quintile, council (atlas.geo)
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


def hero_by_council() -> dict:
    """The opening's daily figures for each council (for a pinned area).

    A&E is counted by the health board of the hospital (the data has no council of residence),
    so each council carries its board's attendances, named; injuries and prescribing are the
    council's own. Periods match hero().

    Returns:
        By council: health board, its A&E attendances, and the council's injury admissions,
        injury deaths and prescription items in the hero periods.
    """
    board = {}
    with Path("data/derived/population_ae.csv").open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            board.setdefault(r["council"], r["hb"])
    ae = {r["health_board"]: int(r["attendances"]) for r in read(AE / "attendances_by_board.csv")}
    nat = hero()
    year = {
        (r["dataset"], r["year"], r["council"]): int(r["events"])
        for r in read(INJ / "council_year.csv")
    }
    items = {r["council"]: int(r["items"]) for r in read(RX / "council.csv")}
    return {
        c: {
            "health_board": board[c],
            "ae_attendances": ae[board[c]],
            "injury_admissions": year[("admissions", nat["injury_admissions"]["period"], c)],
            "injury_deaths": year[("deaths", nat["injury_deaths"]["period"], c)],
            "prescription_items": items[c],
        }
        for c in sorted(items)
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


def death_trend() -> dict:
    """Deaths from falls and from poisoning in each year: counts and standardised rates.

    Returns:
        Years, and for each type the deaths and the rate per 100,000 (age-sex standardised).
    """
    rows = [r for r in read(INJ / "national.csv") if r["dataset"] == "deaths"]
    years = sorted({r["year"] for r in rows})
    out: dict = {"years": [int(y) for y in years]}
    for t in ("Falls", "Poisoning"):
        by = {r["year"]: r for r in rows if r["injury_type"] == t}
        out[t.lower()] = {
            "deaths": [int(by[y]["events"]) for y in years],
            "rate": [float(by[y]["rate"]) for y in years],
        }
    return out


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
    """Council figures for the poisoning map, the scatter and the council filter.

    Returns:
        Period, Scotland rates, each council's poisoning death rate (interval, quintile-1 share,
        against Scotland), falls admission rate, prescription items per person and deaths by age
        band over the pooled years, and Spearman's rho for poisoning deaths and falls admissions.
    """
    rate = {(r["dataset"], r["injury_type"], r["council"]): r for r in read(INJ / "council.csv")}
    rows = [v for (d, t, _c), v in rate.items() if d == "deaths" and t == "Poisoning"]
    falls = {c: v for (d, t, c), v in rate.items() if d == "admissions" and t == "Falls"}
    falls_rank = {
        c: k + 1 for k, c in enumerate(sorted(falls, key=lambda c: -float(falls[c]["rate"])))
    }
    rx = read(RX / "council.csv")
    items = {r["council"]: float(r["items_per_person"]) for r in rx}
    # Scotland: items placed in a council over everyone living in one (unplaced items left out)
    scot_items = sum(int(r["items"]) for r in rx) / sum(int(r["population"]) for r in rx)
    ages: dict[tuple, list[int]] = {}
    bands: list[str] = []
    for r in read(INJ / "council_age.csv"):
        if r["dataset"] != "deaths":
            continue
        if r["age_band"] not in bands:
            bands.append(r["age_band"])
        ages.setdefault((r["council"], r["injury_type"]), []).append(int(r["events"]))
    eco = {
        (r["dataset"], r["injury_type"]): float(r["spearman_rho"])
        for r in read(INJ / "ecological.csv")
    }
    any_falls = next(iter(falls.values()))
    return {
        "period": rows[0]["period"],
        "falls_period": any_falls["period"],
        "scotland": float(rows[0]["scotland_rate"]),
        "scotland_falls": float(any_falls["scotland_rate"]),
        "scotland_items_per_person": round(scot_items, 2),
        "pooled_years": int(rows[0]["period"][-4:]) - int(rows[0]["period"][:4]) + 1,
        "councils": [
            {
                "council": r["council"],
                "rate": float(r["rate"]),
                "lower": float(r["lower"]),
                "upper": float(r["upper"]),
                "share_q1": float(r["share_simd_q1"]),
                "vs": r["vs_scotland"],
                "falls_rate": float(falls[r["council"]]["rate"]),
                "falls_vs": falls[r["council"]]["vs_scotland"],
                "falls_rank": falls_rank[r["council"]],
                "items_per_person": items[r["council"]],
                # deaths in the pooled years by age band (same bands as injury_ages)
                "deaths_falls": ages[(r["council"], "Falls")],
                "deaths_poisoning": ages[(r["council"], "Poisoning")],
            }
            for r in sorted(rows, key=lambda r: r["council"])
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


def deprived_zones() -> dict:
    """Where Scotland's most deprived neighbourhoods are: SIMD quintile 1 data zones by council.

    Returns:
        The number of quintile-1 zones in Scotland, and for each council its quintile-1 zones and
        all its zones.
    """
    by: dict[str, list[int]] = {}
    for r in read(LOOKUP):
        c = by.setdefault(r["council"], [0, 0])
        c[0] += r["quintile"] == "1"
        c[1] += 1
    return {
        "total_q1": sum(v[0] for v in by.values()),
        "total": sum(v[1] for v in by.values()),
        "by_council": {k: {"q1": v[0], "zones": v[1]} for k, v in sorted(by.items())},
    }


def access() -> dict:
    """Waiting in emergency departments by year, and GPs per patient by practice deprivation.

    Returns:
        Years with the shares seen within 4 hours and waiting over 8 and 12 hours (Type 1 sites);
        per SIMD quintile of the practice, patients and GPs (headcount and whole-time equivalent)
        per 10,000 patients; and the board check against NES's own rates.
    """
    ed = [r for r in read(ACCESS / "waits.csv") if r["site"] == "Type 1"]
    gp = read(ACCESS / "gp_quintile.csv")
    boards = read(ACCESS / "gp_board.csv")
    return {
        "waits": {
            "years": [int(r["year"]) for r in ed],
            "within_4h": [float(r["within_4h"]) for r in ed],
            "over_8h": [float(r["over_8h"]) for r in ed],
            "over_12h": [float(r["over_12h"]) for r in ed],
            "attendances": [int(r["attendances"]) for r in ed],
            "target": 0.95,
        },
        "gp": {
            "date": "31 March 2025",
            "quintiles": [
                {
                    "quintile": int(r["simd_quintile"]),
                    "patients": int(r["patients"]),
                    "wte_per_10000": float(r["wte_per_10000"]),
                    "headcount_per_10000": float(r["headcount_per_10000"]),
                }
                for r in gp
            ],
            "board_check_max_difference": max(
                abs(float(r["wte_per_10000"]) - float(r["nes_wte_per_10000"])) for r in boards
            ),
        },
    }


def story() -> dict:
    """Everything the page needs.

    Returns:
        The story data.
    """
    return {
        "hero": hero(),
        "hero_by_council": hero_by_council(),
        "ae": ae_gap(),
        "injury_ages": injury_ages(),
        "death_trend": death_trend(),
        "councils": councils(),
        "medicines": medicines(),
        "deprived_zones": deprived_zones(),
        "access": access(),
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
