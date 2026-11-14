"""Community prescribing by the deprivation of the area where medicines are dispensed.

Usage (from the repository root): uv run python -m atlas.prescribing [output folder]

Prescribing is recorded where medicines are dispensed, not where patients live. Each dispensing
location's postcode is placed in its 2011 data zone with the SIMD 2020v2 postcode look-up, and from
there in its SIMD quintile and council area (SIMD 2020v2 data zone look-up). Items are compared
with the population of the same quintile or council (NRS mid-2024 estimates, all ages): a measure
of how much is dispensed in an area per person living there, not of how much its residents
receive, since people also collect medicines elsewhere (near work, in town centres).

Locations with no address in any month of any file cannot be placed (356 location codes); their
share of items fell from 24% in 2019 to 2% in 2025, so comparisons between quintiles use the latest
twelve months only (June 2025 to May 2026), and the monthly series starts in January 2024. The mix
of medicines by chapter is compared as shares of each quintile's items, which needs no population.

Writes locations.csv, quintile.csv, chapters.csv, council.csv, monthly.csv and the figures
quintiles and councils (PDF, SVG, PNG) to the output folder.
"""

from __future__ import annotations

import csv
import sys
from collections import defaultdict
from pathlib import Path

import duckdb
import numpy as np
import openpyxl

from .distributions import label_of
from .population import lookup
from .stats import spearman

FILES = "data/raw/data-viz-2026/data/Prescribing/File_*.csv"
POSTCODES = "data/external/simd2020v2_postcode_lookup_2025.xlsx"
POP = Path("data/derived/population_ae.csv")
PERIOD = (202506, 202605)  # the latest twelve whole months
MONTHLY_FROM = 202401  # unplaced items under 3% from here on
POP_YEAR = 2024
CHAPTERS_SHOWN = 8


def postcode_key(postcode: str) -> str:
    """A postcode in one form for matching: upper case, no spaces.

    Args:
        postcode: As written ("g22 5er", "G22  5ER ").

    Returns:
        The key ("G225ER").
    """
    return "".join(postcode.split()).upper()


def postcode_zones() -> dict[str, str]:
    """Every Scottish postcode and its 2011 data zone.

    Returns:
        Data zone code by postcode key (`postcode_key`).
    """
    ws = openpyxl.load_workbook(POSTCODES, read_only=True)["All postcodes"]
    return {postcode_key(r[0]): r[1] for r in ws.iter_rows(min_row=2, values_only=True) if r[0]}


def population() -> tuple[dict[int, float], dict[str, float], dict[str, float]]:
    """Mid-2024 population by SIMD quintile and by council, and each council's quintile-1 share.

    Returns:
        Population by quintile, population by council, share in quintile 1 by council.
    """
    by_q: dict[int, float] = defaultdict(float)
    by_c: dict[str, float] = defaultdict(float)
    q1: dict[str, float] = defaultdict(float)
    with POP.open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if int(r["year"]) != POP_YEAR:
                continue
            n = float(r["population"])
            by_q[int(r["simd_quintile"])] += n
            by_c[r["council"]] += n
            if r["simd_quintile"] == "1":
                q1[r["council"]] += n
    return by_q, by_c, {c: q1[c] / by_c[c] for c in by_c}


def main() -> None:
    """Place every dispensing location, compute the tables and draw the figures."""
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("results/2026-11-14-prescribing")
    out.mkdir(parents=True, exist_ok=True)
    zones, dz = postcode_zones(), lookup()
    pop_q, pop_c, q1_share = population()
    con = duckdb.connect()
    con.execute(
        f"CREATE TABLE p AS SELECT * FROM read_csv('{FILES}', union_by_name=true, "
        "header=true, sample_size=-1)"
    )
    # one postcode per location: the latest one it was given
    locs = con.execute(
        """SELECT DispLocationCode, arg_max(upper(trim(DispLocationPostcode)), PaidDateMonth),
                  min(PaidDateMonth), max(PaidDateMonth)
           FROM p WHERE DispLocationPostcode IS NOT NULL GROUP BY 1"""
    ).fetchall()
    place = {}
    loc_rows = []
    for code, pc, first, last in locs:
        z = zones.get(postcode_key(pc))
        info = dz.get(z, {})
        place[code] = (info.get("quintile"), info.get("council"))
        loc_rows.append(
            {
                "location_code": code,
                "postcode": pc,
                "data_zone": z,
                "simd_quintile": info.get("quintile"),
                "council": info.get("council"),
                "first_month": first,
                "last_month": last,
            }
        )

    rows = con.execute(
        """SELECT PaidDateMonth, DispLocationCode, "Chapter Description", sum(NumberOfPaidItems)
           FROM p GROUP BY ALL"""
    ).fetchall()
    in_period = [r for r in rows if PERIOD[0] <= r[0] <= PERIOD[1]]

    items_q: dict = defaultdict(float)
    chapter_q: dict = defaultdict(float)
    items_c: dict = defaultdict(float)
    active_q: dict = defaultdict(set)
    for _m, code, chapter, n in in_period:
        q, c = place.get(code, (None, None))
        items_q[q] += n
        chapter_q[(q, label_of(str(chapter)))] += n
        if c:
            items_c[c] += n
        if q:
            active_q[q].add(code)
    total = sum(items_q.values())
    quintile = [
        {
            "simd_quintile": q,
            "pharmacies": len(active_q[q]),
            "items": int(items_q[q]),
            "share_of_items": round(items_q[q] / total, 4),
            "population": round(pop_q[q]),
            "items_per_person": round(items_q[q] / pop_q[q], 2),
            "pharmacies_per_10000": round(1e4 * len(active_q[q]) / pop_q[q], 2),
        }
        for q in range(1, 6)
    ]
    quintile.append(
        {
            "simd_quintile": "unplaced",
            "pharmacies": "",
            "items": int(items_q[None]),
            "share_of_items": round(items_q[None] / total, 4),
            "population": "",
            "items_per_person": "",
            "pharmacies_per_10000": "",
        }
    )

    chapters = sorted({ch for (_q, ch) in chapter_q})
    chapter_rows = []
    for ch in chapters:
        row = {"chapter": ch}
        for q in range(1, 6):
            row[f"share_q{q}"] = round(chapter_q[(q, ch)] / items_q[q], 4)
            row[f"per_person_q{q}"] = round(chapter_q[(q, ch)] / pop_q[q], 3)
        row["ratio_per_person_q1_q5"] = (
            round(row["per_person_q1"] / row["per_person_q5"], 2) if row["per_person_q5"] else ""
        )
        chapter_rows.append(row)
    chapter_rows.sort(key=lambda r: -sum(r[f"share_q{q}"] for q in range(1, 6)))

    council = [
        {
            "council": c,
            "items": int(items_c[c]),
            "population": round(pop_c[c]),
            "items_per_person": round(items_c[c] / pop_c[c], 2),
            "share_simd_q1": round(q1_share[c], 4),
        }
        for c in sorted(pop_c)
    ]
    rho = spearman([r["items_per_person"] for r in council], [r["share_simd_q1"] for r in council])

    monthly: dict = defaultdict(float)
    for m, code, _ch, n in rows:
        if m >= MONTHLY_FROM:
            monthly[(m, place.get(code, (None, None))[0])] += n
    monthly_rows = [
        {
            "month": m,
            "simd_quintile": q if q else "unplaced",
            "items": int(n),
            "items_per_1000_people": round(1e3 * n / pop_q[q], 1) if q else "",
        }
        for (m, q), n in sorted(monthly.items(), key=lambda kv: (kv[0][0], str(kv[0][1])))
    ]

    for name, table in (
        ("locations", loc_rows),
        ("quintile", quintile),
        ("chapters", chapter_rows),
        ("council", council),
        ("monthly", monthly_rows),
    ):
        with (out / f"{name}.csv").open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(table[0]))
            w.writeheader()
            w.writerows(table)
    chart_quintiles(quintile, chapter_rows, out / "quintiles")
    chart_councils(council, rho, out / "councils")
    for r in quintile:
        print(r)
    print("spearman", round(rho, 3))
    for r in chapter_rows[:CHAPTERS_SHOWN]:
        print(r["chapter"], r["share_q1"], r["share_q5"], r["ratio_per_person_q1_q5"])


def chart_quintiles(quintile: list[dict], chapters: list[dict], stem: Path) -> None:
    """(a) items per person and (b) pharmacies per 10,000 people by quintile; (c) medicine mix.

    Args:
        quintile: The quintile rows.
        chapters: The chapter rows, largest first.
        stem: Where to save, without extension.
    """
    import matplotlib.pyplot as plt

    from . import style

    style.use()
    fig = plt.figure(figsize=(style.DOUBLE, 120 * style.MM))
    gs = fig.add_gridspec(2, 2, height_ratios=[1, 1.25], hspace=0.75, wspace=0.45)
    qs = [r for r in quintile if r["simd_quintile"] != "unplaced"]
    names = [style.QUINTILE_NAME[r["simd_quintile"]].replace(" ", "\n", 1) for r in qs]
    colours = [style.QUINTILE[r["simd_quintile"]] for r in qs]
    for i, (key, title, fmt) in enumerate(
        (
            ("items_per_person", "Items dispensed per person a year", "{:.0f}"),
            ("pharmacies_per_10000", "Dispensing locations per 10,000 people", "{:.1f}"),
        )
    ):
        ax = fig.add_subplot(gs[0, i])
        vals = [r[key] for r in qs]
        ax.bar(range(5), vals, color=colours, width=0.68)
        for x, v in enumerate(vals):
            ax.text(x, v, fmt.format(v), ha="center", va="bottom", fontsize=6.5, color=style.INK_2)
        ax.set_xticks(range(5), names)
        ax.tick_params(axis="x", length=0, labelsize=6.5)
        ax.set_ylim(0, max(vals) * 1.15)
        ax.set_xlabel("SIMD quintile of the dispensing location")
        ax.set_title(title)
        style.panel(ax, "ab"[i])

    # (c) the mix: each chapter's share of a quintile's items, most and least deprived
    ax = fig.add_subplot(gs[1, :])
    shown = chapters[:CHAPTERS_SHOWN][::-1]
    y = np.arange(len(shown))
    for yy, r in zip(y, shown, strict=True):
        a, b = 100 * r["share_q1"], 100 * r["share_q5"]
        ax.plot([a, b], [yy, yy], color="#c9c8c3", lw=1.2, zorder=1)
        ax.plot(a, yy, "o", color=style.QUINTILE[1], ms=4.5, zorder=2)
        ax.plot(b, yy, "o", color=style.QUINTILE[5], ms=4.5, zorder=2)
    ax.set_yticks(y, [r["chapter"] for r in shown])
    ax.tick_params(axis="y", length=0, labelsize=6.5)
    ax.set_xlim(left=0)
    ax.set_ylim(-0.6, len(shown) - 0.2)
    ax.set_xlabel("Share of the quintile's items (%)")
    top = shown[-1]
    for q, va in ((1, "bottom"), (5, "top")):
        ax.annotate(
            style.QUINTILE_NAME[q],
            (100 * top[f"share_q{q}"], len(shown) - 1),
            xytext=(0, 5 if va == "bottom" else -5),
            textcoords="offset points",
            ha="center",
            va=va,
            fontsize=6.5,
            color=style.QUINTILE[q],
        )
    ax.set_title("Mix of medicines dispensed, most and least deprived fifth (BNF chapter)")
    style.panel(ax, "c")
    style.source(
        fig,
        style.SOURCE_PHS + "; SIMD 2020v2 postcode and data zone look-ups; NRS "
        "mid-2024 population. June 2025 to May 2026. Counted where medicines are "
        f"dispensed, not where patients live; {100 * quintile[-1]['share_of_items']:.1f}% "
        "of items, at locations with no address, are left out.",
    )
    style.save(fig, stem)


def chart_councils(council: list[dict], rho: float, stem: Path) -> None:
    """Items dispensed per person by council against the share of people in quintile 1.

    Args:
        council: The council rows.
        rho: Spearman's rho.
        stem: Where to save, without extension.
    """
    import matplotlib.pyplot as plt

    from . import style

    style.use()
    fig, ax = plt.subplots(figsize=(style.SINGLE * 1.25, 80 * style.MM))
    xs = [100 * r["share_simd_q1"] for r in council]
    ys = [r["items_per_person"] for r in council]
    ax.scatter(xs, ys, s=14, color=style.CATEGORICAL[0], edgecolor="white", linewidth=0.5, zorder=3)
    ax.set_xlim(-1.5, 50)
    ax.set_ylim(0, max(ys) * 1.1)
    ax.text(
        0.03,
        0.97,
        f"Spearman ρ = {rho:.2f} (32 council areas)",
        transform=ax.transAxes,
        fontsize=6.5,
        color=style.INK_2,
        va="top",
    )
    named = (
        sorted(council, key=lambda r: -r["items_per_person"])[:3]
        + sorted(council, key=lambda r: r["items_per_person"])[:2]
    )
    style.label_points(  # after the note, so labels keep clear of it
        ax,
        [(r["council"], 100 * r["share_simd_q1"], r["items_per_person"]) for r in named],
        avoid=list(zip(xs, ys, strict=True)),
    )
    ax.set_xlabel("People living in the most deprived fifth\nof Scotland's data zones (%)")
    ax.set_ylabel("Items dispensed per person a year")
    ax.set_title("Prescribing by council area, June 2025 to May 2026", fontsize=8)
    style.source(
        fig,
        style.SOURCE_PHS + "; SIMD 2020v2; NRS mid-2024 population. Counted "
        "where dispensed. Areas compared, not people.",
    )
    style.save(fig, stem)


if __name__ == "__main__":
    main()
