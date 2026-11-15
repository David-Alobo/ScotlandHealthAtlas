"""Access to care: waiting in A&E (2008 to 2025) and GPs per patient by deprivation (March 2025).

Usage (from the repository root): uv run python -m atlas.access [output folder]

Waiting in A&E, from the competition's A&E activity file: for each whole calendar year and type of
site (Type 1, emergency departments; Type 3, minor injury units and other sites), attendances, the
share seen within 4 hours (the "All" category, as the national standard counts them), and the
shares waiting more than 8 and more than 12 hours (the "Episode" measures, the only ones with those
waits); and the same for emergency departments by health board in the latest whole year.

GPs per patient, from two outside sources (data/README.md): NHS Education for Scotland's General
Practice Workforce Survey 2025 (GPs on 31 March 2025, specialty trainees excluded: Table 5 by
board, Table 6 over time, Table 8 by the SIMD quintile of the practice) and Public Health Scotland's
practice list sizes for April 2025, the nearest to that date. NES does not say how it places a
practice in a quintile; we assume by the data zone of the practice's address, which the list-size
file gives, and so place each practice's registered patients in the same quintile. The board rates
are recomputed from the list sizes as a check on the denominator against NES's own (Table 5).
Writes waits.csv, waits_board.csv, gp_quintile.csv, gp_board.csv, gp_trend.csv and the figures
waits.pdf/.svg/.png and gp.pdf/.svg/.png to the output folder.
"""

from __future__ import annotations

import csv
import html
import re
import sys
from collections import defaultdict
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

import duckdb

ACTIVITY = "data/raw/data-viz-2026/data/A&E/Level_1_Activity.csv"
NES = Path("data/external/gp/nes-gpws-2025.html")
LIST_SIZES = Path("data/external/gp/practice_contactdetails_apr2025.csv")
DZ = Path("data/derived/dz_lookup.csv")
YEARS = range(2008, 2026)  # whole calendar years (the file runs from July 2007 to June 2026)
TARGET = 0.95  # the Scottish Government's standard: 95% seen within 4 hours
# health board codes in the list-size file, named as NES names them
BOARDS = {
    "S08000015": "NHS Ayrshire & Arran", "S08000016": "NHS Borders",
    "S08000017": "NHS Dumfries & Galloway", "S08000019": "NHS Forth Valley",
    "S08000020": "NHS Grampian", "S08000022": "NHS Highland", "S08000024": "NHS Lothian",
    "S08000025": "NHS Orkney", "S08000026": "NHS Shetland", "S08000028": "NHS Western Isles",
    "S08000029": "NHS Fife", "S08000030": "NHS Tayside",
    "S08000031": "NHS Greater Glasgow & Clyde", "S08000032": "NHS Lanarkshire",
}  # fmt: skip


def waits(con: duckdb.DuckDBPyConnection) -> tuple[list[dict], list[dict]]:
    """A&E waits by year and site type, and emergency departments by board in the latest year.

    Args:
        con: A DuckDB connection.

    Returns:
        The national rows and the board rows.
    """
    sql = f"""SELECT {{key}}, sum(NumberOfAttendancesAll), sum(NumberWithin4HoursAll),
                     sum(NumberOfAttendancesEpisode), sum(NumberOver8HoursEpisode),
                     sum(NumberOver12HoursEpisode)
              FROM read_csv('{ACTIVITY}', header=true, sample_size=-1)
              WHERE AttendanceCategory = 'All' AND {{where}}
              GROUP BY ALL ORDER BY ALL"""

    def row(n: float, w4: float, ep: float, o8: float, o12: float) -> dict:
        return {
            "attendances": int(n),
            "within_4h": round(w4 / n, 4),
            "over_8h": round(o8 / ep, 5),
            "over_12h": round(o12 / ep, 5),
        }

    national = [
        {"year": y, "site": t, **row(*v)}
        for y, t, *v in con.execute(
            sql.format(
                key="Month // 100, DepartmentType",
                where=f"Month // 100 BETWEEN {YEARS[0]} AND {YEARS[-1]}",
            )
        ).fetchall()
    ]
    boards = [
        {"year": YEARS[-1], "health_board": hb, **row(*v)}
        for hb, *v in con.execute(
            sql.format(
                key="HBName", where=f"Month // 100 = {YEARS[-1]} AND DepartmentType = 'Type 1'"
            )
        ).fetchall()
    ]
    return national, boards


def nes_tables() -> dict[int, list[list[str]]]:
    """Tables 5, 6 and 8 of the NES report, read from the saved page.

    Returns:
        Each table's data rows, as lists of cells.
    """
    page = NES.read_text(encoding="utf-8")
    text = re.sub(r"<script.*?</script>|<style.*?</style>", " ", page, flags=re.S)
    text = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", text)))
    num = r"[\d,]+(?:\.\d+)?%?"
    patterns = {
        5: rf"((?:NHS [A-Z][A-Za-z &]+?|Scotland) {num} {num} {num} {num} {num})",
        6: "",  # by position, below
        8: rf"(\d(?: \((?:Most|Least) Deprived\))? {num} {num} {num})",
    }
    ends = {5: "1. Doctors", 6: "GPs by designation", 8: "Figure 4"}
    out = {}
    for n, pat in patterns.items():
        start = text.index(f"Table {n}:")
        body = text[start : text.index(ends[n], start)]
        if n == 6:  # a new row at each survey year; the first year has no change columns
            rows: list[list[str]] = []
            for tok in body.split(" WTE % change ", 1)[1].split():
                if re.fullmatch(r"20\d\d", tok):
                    rows.append([tok])
                elif rows:
                    rows[-1].append(tok)
            out[n] = rows
        else:
            out[n] = [m.split(" ") for m in re.findall(pat, body)]
    return out


def number(s: str) -> float:
    """A figure as printed ("4,582", "3,591.5") as a number."""
    return float(s.replace(",", ""))


def gps(nes: dict[int, list[list[str]]]) -> tuple[list[dict], list[dict], list[dict]]:
    """GPs per 10,000 patients by practice deprivation quintile, the board check and the trend.

    Args:
        nes: NES tables 5, 6 and 8.

    Returns:
        The quintile rows, the board rows and the trend rows.
    """
    quintile = {}
    with DZ.open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            quintile[r["DataZone"]] = int(r["quintile"])
    patients: dict[int, float] = defaultdict(float)
    practices: dict[int, int] = defaultdict(int)
    board_patients: dict[str, float] = defaultdict(float)
    with LIST_SIZES.open(encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            q = quintile[r["DataZone"]]
            patients[q] += float(r["PracticeListSize"])
            practices[q] += 1
            board_patients[BOARDS[r["HB"]]] += float(r["PracticeListSize"])

    by_q = []
    for cells in nes[8]:
        q = int(cells[0])
        head, wte = number(cells[-3]), number(cells[-2])
        by_q.append({
            "simd_quintile": q, "practices": practices[q], "patients": int(patients[q]),
            "gp_headcount": int(head), "gp_wte": wte,
            "wte_per_10000": round(1e4 * wte / patients[q], 2),
            "headcount_per_10000": round(1e4 * head / patients[q], 2),
        })  # fmt: skip

    boards = []
    for cells in nes[5]:
        name = " ".join(cells[:-5])
        head, wte, _mean, nes_wte_rate, nes_head_rate = (number(c) for c in cells[-5:])
        p = sum(board_patients.values()) if name == "Scotland" else board_patients[name]
        boards.append({
            "health_board": name, "gp_headcount": int(head), "gp_wte": wte, "patients": int(p),
            "wte_per_10000": round(1e4 * wte / p, 2), "nes_wte_per_10000": nes_wte_rate,
            "headcount_per_10000": round(1e4 * head / p, 2),
            "nes_headcount_per_10000": nes_head_rate,
        })  # fmt: skip

    trend = []
    for cells in nes[6]:
        values = [c for c in cells[1:] if not c.endswith("%")]
        trend.append({"year": int(cells[0]), "gp_headcount": int(number(values[0])),
                      "gp_wte": number(values[1])})  # fmt: skip
    return by_q, boards, trend


def gp_ratios(by_q: list[dict], boards: list[dict]) -> list[dict]:
    """Registered patients per GP and per full-time GP, by quintile and for Scotland.

    Args:
        by_q: The quintile rows.
        boards: The board rows (the Scotland row gives the national figures).

    Returns:
        One row per quintile and one for Scotland.
    """
    scot = next(r for r in boards if r["health_board"] == "Scotland")
    rows = [(f"quintile {r['simd_quintile']}", r) for r in by_q] + [("Scotland", scot)]
    return [
        {
            "area": name,
            "patients": r["patients"],
            "gp_headcount": r["gp_headcount"],
            "gp_wte": r["gp_wte"],
            "patients_per_gp": round(r["patients"] / r["gp_headcount"]),
            "patients_per_wte_gp": round(r["patients"] / r["gp_wte"]),
        }
        for name, r in rows
    ]


def gp_scenarios(by_q: list[dict]) -> list[dict]:
    """What longer GP hours in the most deprived fifth would give (arithmetic, not a forecast).

    Two scenarios for practices in quintile 1, its GP headcount held: its GPs work the mean
    whole-time equivalent of quintile 5's GPs; or they work enough to give quintile 1's patients
    as much GP time per patient as quintile 5's. One WTE is 8 sessions a week (NES).

    Args:
        by_q: The quintile rows.

    Returns:
        One row per scenario, with the real figures first.
    """
    q1, q5 = by_q[0], by_q[-1]
    mean5 = q5["gp_wte"] / q5["gp_headcount"]
    target = q5["gp_wte"] / q5["patients"]  # WTE per patient in quintile 5
    cases = [
        ("as recorded", q1["gp_wte"]),
        ("quintile 1 GPs work quintile 5's mean WTE", q1["gp_headcount"] * mean5),
        ("quintile 1 patients get quintile 5's GP time", target * q1["patients"]),
    ]
    out = []
    for name, wte in cases:
        extra = wte - q1["gp_wte"]
        out.append({
            "scenario": name, "q1_wte": round(wte, 1),
            "mean_wte_per_gp": round(wte / q1["gp_headcount"], 3),
            "extra_wte": round(extra, 1), "extra_sessions_a_week": round(8 * extra),
            "extra_sessions_per_gp_a_week": round(8 * extra / q1["gp_headcount"], 2),
            "q1_wte_per_10000": round(1e4 * wte / q1["patients"], 2),
            "q5_wte_per_10000": round(1e4 * target, 2),
            "q1_patients_per_wte_gp": round(q1["patients"] / wte),
            "gap_to_q5": round(1 - wte / (target * q1["patients"]), 4),
        })  # fmt: skip
    return out


def write(rows: list[dict], path: Path) -> None:
    """Write rows of dicts to a CSV file."""
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)


def main() -> None:
    """Compute both analyses, check the GP denominators, and draw the charts."""
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("results/2026-11-15-access")
    out.mkdir(parents=True, exist_ok=True)
    national, boards = waits(duckdb.connect())
    write(national, out / "waits.csv")
    write(boards, out / "waits_board.csv")
    nes = nes_tables()
    assert [len(nes[n]) for n in (5, 6, 8)] == [15, 8, 5], {k: len(v) for k, v in nes.items()}
    by_q, gp_boards, trend = gps(nes)
    # NES's quintile WTEs sum to its national WTE, and our board rates match its own to 0.1
    assert abs(sum(r["gp_wte"] for r in by_q) - 3591.5) < 0.05
    worst = max(abs(r["wte_per_10000"] - r["nes_wte_per_10000"]) for r in gp_boards)
    print(f"board check: largest difference from NES's WTE per 10,000 patients: {worst:.2f}")
    write(by_q, out / "gp_quintile.csv")
    write(gp_boards, out / "gp_board.csv")
    write(trend, out / "gp_trend.csv")
    write(gp_ratios(by_q, gp_boards), out / "gp_ratios.csv")
    write(gp_scenarios(by_q), out / "gp_scenarios.csv")
    chart_waits(national, out / "waits")
    chart_gp(by_q, out / "gp")
    for r in national:
        if r["site"] == "Type 1" and r["year"] in (YEARS[0], 2019, YEARS[-1]):
            print(r)
    for r in by_q:
        print(r)


def chart_waits(rows: list[dict], stem: Path) -> None:
    """Emergency departments: the share seen within 4 hours, and the share waiting over 12.

    Args:
        rows: The national rows.
        stem: Where to save, without extension (PDF, SVG and PNG are written).
    """
    import matplotlib.pyplot as plt

    from . import style

    style.use()
    ed = [r for r in rows if r["site"] == "Type 1"]
    xs = [r["year"] for r in ed]
    fig, (a, b) = plt.subplots(1, 2, figsize=(style.DOUBLE, 70 * style.MM))
    a.plot(xs, [100 * r["within_4h"] for r in ed], color=style.QUINTILE[2], marker="o")
    a.axhline(100 * TARGET, color=style.INK, lw=0.8, ls="--")
    # the label sits above the line at the right, clear of the data, which is far below it there
    a.annotate("95% standard", (xs[-1], 100 * TARGET), xytext=(0, 4), textcoords="offset points",
               ha="right", fontsize=7)  # fmt: skip
    a.set_ylim(50, 100)
    a.set_ylabel("Seen within 4 hours (%)")
    b.plot(xs, [100 * r["over_12h"] for r in ed], color=style.QUINTILE[1], marker="o")
    b.set_ylim(0, 7)
    b.set_ylabel("Waiting over 12 hours (%)")
    for ax, letter in ((a, "a"), (b, "b")):
        ax.set_xticks(list(range(2008, 2026, 4)))
        style.panel(ax, letter)
    style.titles(
        fig, a, "Waiting in Scotland's emergency departments",
        "Share of attendances at Type 1 sites, by calendar year",
    )  # fmt: skip
    style.source(fig, style.SOURCE_PHS + " (A&E activity).")
    style.save(fig, stem)


def chart_gp(rows: list[dict], stem: Path) -> None:
    """GPs (whole-time equivalent) per 10,000 registered patients by practice deprivation.

    Args:
        rows: The quintile rows.
        stem: Where to save, without extension (PDF, SVG and PNG are written).
    """
    import matplotlib.pyplot as plt

    from . import style

    style.use()
    fig, ax = plt.subplots(figsize=(style.SINGLE * 1.3, 62 * style.MM))
    qs = [r["simd_quintile"] for r in rows]
    vals = [r["wte_per_10000"] for r in rows]
    ax.barh([style.QUINTILE_NAME[q] for q in qs], vals, color=[style.QUINTILE[q] for q in qs])
    for y, v in enumerate(vals):
        # halves round up, as in the paper and the atlas (6.35 -> 6.4)
        text = str(Decimal(str(v)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))
        ax.annotate(text, (v, y), xytext=(4, 0), textcoords="offset points", va="center",
                    fontsize=7)  # fmt: skip
    ax.invert_yaxis()
    style.panel(ax, "c")
    ax.set_xlabel("GPs (whole-time equivalent) per 10,000 patients")
    style.titles(
        fig, ax, "GPs per patient by deprivation of the practice's area",
        "SIMD 2020v2 quintile of the practice address; GPs on 31 March 2025",
    )  # fmt: skip
    style.source(fig, "Data: NHS Education for Scotland, GP Workforce Survey 2025 (Table 8); "
                 "PHS practice list sizes, April 2025.")  # fmt: skip
    style.save(fig, stem)


if __name__ == "__main__":
    main()
