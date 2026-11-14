"""Distributions of every dataset: spread of the numbers, totals over time, totals by category.

Usage (from the repository root): uv run python -m atlas.distributions [output folder]

Unlike the audit (which counts rows), totals here are weighted by what each row counts:
attendances, admissions, deaths or prescription items. For each dataset it writes, to the output
folder (default results/<today>-distributions/):

- `<dataset>_numeric.csv`: for every numeric column, percentiles 1, 5, 25, 50, 75, 95 and 99,
  mean, the share of zeros and of missing values;
- `<dataset>_time.csv`: the total by month (or year) and, where the file has them, by type;
- `<dataset>_by_<column>.csv`: the total for each value of each category column;
- `<dataset>.pdf/.svg/.png`: publication figures (see style.py): the total over time,
  the totals by its main categories, and the cumulative distribution of per-row counts
  (log scale).
"""

from __future__ import annotations

import csv
import datetime as dt
import sys
from pathlib import Path

import duckdb
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

RAW = "data/raw/data-viz-2026/data"
DATASETS = {
    "ae_activity": {
        "files": [f"{RAW}/A&E/Level_1_Activity.csv"],
        # 'All' already sums the other two categories: count it alone
        "where": "AttendanceCategory = 'All'",
        "measure": "NumberOfAttendancesAll",
        "time": "Month",
        "split": "DepartmentType",
        "categories": ["HBName", "DepartmentType"],
        "numeric": [
            "NumberOfAttendancesAll",
            "PercentageWithin4HoursAll",
            "PercentageOver8HoursEpisode",
            "PercentageOver12HoursEpisode",
        ],
    },
    "ae_demographics": {
        "files": [f"{RAW}/A&E/Level_2_Demographics.csv"],
        "where": "TRUE",
        "measure": "NumberOfAttendances",
        "time": "Month",
        "split": "DepartmentType",
        "categories": ["HBName", "DepartmentType", "Age", "Sex", "Deprivation"],
        "numeric": ["NumberOfAttendances"],
    },
    "injury_admissions": {
        "files": [f"{RAW}/Unintentional_Injuries/Admissions.csv"],
        "where": "TRUE",
        "measure": "Number",
        "time": "Year",
        "split": "InjuryType",
        "categories": ["AgeGroup", "Sex", "InjuryType", "InjuryLocation", "HBR", "CAName"],
        "numeric": ["Number"],
    },
    "injury_deaths": {
        "files": [f"{RAW}/Unintentional_Injuries/Deaths.csv"],
        "where": "TRUE",
        "measure": "Number",
        "time": "Year",
        "split": "InjuryType",
        "categories": ["AgeGroup", "Sex", "InjuryType", "InjuryLocation", "HBR", "CAName"],
        "numeric": ["Number"],
    },
    "prescribing": {
        "files": [
            f"{RAW}/Prescribing/File_A_2019-21.csv",
            f"{RAW}/Prescribing/File_B_2022-24.csv",
            f"{RAW}/Prescribing/File_C_2025-26.csv",
        ],
        "where": "TRUE",
        "measure": "NumberOfPaidItems",
        "time": "PaidDateMonth",
        "split": None,
        "categories": ['"Chapter Description"', "HBName"],
        "numeric": ["NumberOfPaidItems", "PaidQuantity", "GrossIngredientCost"],
    },
}
PERCENTILES = (0.01, 0.05, 0.25, 0.5, 0.75, 0.95, 0.99)


def write(path: Path, header: list[str], rows: list) -> None:
    """Write a CSV table.

    Args:
        path: The file.
        header: Column names.
        rows: The rows.
    """
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)


def profile(con: duckdb.DuckDBPyConnection, name: str, spec: dict, out: Path) -> dict:
    """Profile one dataset and save its tables.

    Args:
        con: A DuckDB connection.
        name: The dataset's name.
        spec: Its files, filter, measure, time column, split and columns.
        out: The output folder.

    Returns:
        What the chart needs: the time series, category totals and the per-row counts.
    """
    files = ", ".join(f"'{f}'" for f in spec["files"])
    con.execute(
        f"CREATE OR REPLACE VIEW t AS SELECT * FROM read_csv([{files}], header=true, "
        f"sample_size=-1, union_by_name=true) WHERE {spec['where']}"
    )
    m = spec["measure"]
    numeric = []
    for col in spec["numeric"]:
        q = ", ".join(f"quantile_cont({col}, {p})" for p in PERCENTILES)
        r = con.execute(
            f"SELECT {q}, avg({col}), avg(({col} = 0)::INT), avg(({col} IS NULL)::INT), "
            f"count(*) FROM t"
        ).fetchone()
        numeric.append([col, *[None if v is None else round(float(v), 4) for v in r]])
    write(
        out / f"{name}_numeric.csv",
        [
            "column",
            *[f"p{int(p * 100)}" for p in PERCENTILES],
            "mean",
            "share_zero",
            "share_missing",
            "rows",
        ],
        numeric,
    )

    split = spec["split"]
    if split:
        time = con.execute(
            f"SELECT {spec['time']}::VARCHAR, {split}::VARCHAR, sum({m}) FROM t "
            f"GROUP BY ALL ORDER BY 1, 2"
        ).fetchall()
        write(out / f"{name}_time.csv", ["period", split, "total"], time)
    else:
        time = con.execute(
            f"SELECT {spec['time']}::VARCHAR, NULL, sum({m}) FROM t GROUP BY 1 ORDER BY 1"
        ).fetchall()
        write(out / f"{name}_time.csv", ["period", "total"], [[p, v] for p, _, v in time])

    cats = {}
    for col in spec["categories"]:
        rows = con.execute(
            f"SELECT coalesce({col}::VARCHAR, '(missing)'), sum({m}) FROM t GROUP BY 1 "
            f"ORDER BY 2 DESC"
        ).fetchall()
        total = sum(v for _, v in rows)
        label = col.strip('"').replace(" ", "_")
        write(
            out / f"{name}_by_{label}.csv",
            [label, "total", "share"],
            [[k, v, round(v / total, 4)] for k, v in rows],
        )
        cats[label] = rows
    counts = [r[0] for r in con.execute(f"SELECT {m} FROM t WHERE {m} > 0").fetchall()]
    return {"time": time, "split": split, "cats": cats, "counts": counts, "measure": m}


UNITS = {
    "ae_activity": ("A&E attendances", "month", "Attendances per month (thousands)", 1000),
    "ae_demographics": ("A&E attendances", "month", "Attendances per month (thousands)", 1000),
    "injury_admissions": ("Admissions", "financial year", "Admissions per year", 1),
    "injury_deaths": ("Deaths", "year", "Deaths per year", 1),
    "prescribing": ("Prescription items", "month", "Items per month (millions)", 1e6),
}
MAIN_CATEGORY = {
    "ae_activity": "HBName",
    "ae_demographics": "Deprivation",
    "injury_admissions": "InjuryType",
    "injury_deaths": "InjuryType",
    "prescribing": "Chapter_Description",
}
CATEGORY_NAMES = {
    "HBName": "health board",
    "Deprivation": "deprivation quintile",
    "InjuryType": "injury type",
    "Chapter_Description": "BNF chapter",
}
LABELS = {
    "Type 1": "Emergency departments (Type 1)",
    "Type 3": "Minor injury units (Type 3)",
    "RTI": "Road traffic",
    "Land transport accidents": "Road traffic",
    "Other": "Other (unclassified)",
    "Missing": "Chapter missing",
    "MUSCULOSKELETAL AND JOINT DISEASES": "Musculoskeletal and joint",
    "OBSTETRICS, GYNAECOLOGY AND URINARY-TRAC": "Obstetrics, gynaecology, urinary",
    "MALIGNANT DISEASE AND IMMUNOSUPPRESSION": "Malignant disease, immunosuppression",
    "IMMUNOLOGICAL PRODUCTS AND VACCINES": "Immunological products, vaccines",
}


def label_of(value: str) -> str:
    """A readable label: board names without "NHS", upper-case chapter names in sentence case.

    Args:
        value: The value as stored.

    Returns:
        The label.
    """
    if value in LABELS:
        return LABELS[value]
    value = value.replace("NHS ", "")
    if value.isupper() and len(value) >= 3:
        value = value.capitalize()
    return value


TITLES = {
    "ae_activity": "A&E activity, by site type",
    "ae_demographics": "A&E attendances with patient demographics",
    "injury_admissions": "Emergency admissions for unintentional injuries",
    "injury_deaths": "Deaths from unintentional injuries",
    "prescribing": "Community prescribing",
}


def chart(name: str, data: dict, spec: dict, stem: Path) -> None:
    """Three panels: (a) total over time, (b) totals by the main category, (c) per-row counts.

    Args:
        name: The dataset's name.
        data: From `profile`.
        spec: The dataset's spec.
        stem: Where to save, without extension (PDF, SVG and PNG are written).
    """
    import numpy as np

    from . import style

    style.use()
    unit, per, ylabel, scale = UNITS[name]
    fig = plt.figure(figsize=(style.DOUBLE, 118 * style.MM))
    gs = fig.add_gridspec(2, 2, height_ratios=[1, 1.15], hspace=0.62, wspace=0.42)

    # (a) over time: at most four lines, each labelled at its end (the three largest types and
    # the rest together); monthly data on a date axis, yearly data on a labelled period axis
    ax = fig.add_subplot(gs[0, :])
    series: dict[str, dict] = {}
    for period, key, total in data["time"]:
        series.setdefault(label_of(str(key)) if key else "Total", {})[period] = total
    order = sorted(series, key=lambda k: -sum(series[k].values()))
    if len(order) > 4:
        rest = {}
        for k in order[3:]:
            for p, v in series[k].items():
                rest[p] = rest.get(p, 0) + v
        combined = f"{len(order) - 3} smaller types together"
        series = {k: series[k] for k in order[:3]} | {combined: rest}
        order = [*order[:3], combined]
    periods = sorted({p for s in series.values() for p in s})
    monthly = per == "month"
    ends = []
    for i, key in enumerate(order):
        pts = sorted(series[key].items())
        xs = [_period(p) if monthly else periods.index(p) for p, _ in pts]
        ys = [v for _, v in pts]
        ax.plot(xs, ys, color=style.CATEGORICAL[i], marker=None if monthly else "o")
        ends.append((key, xs[-1], ys[-1]))
    if not monthly:
        ax.set_xticks(range(len(periods)), periods)
        ax.set_xlim(-0.4, len(periods) - 0.6)
    ax.yaxis.set_major_formatter(style.thousands(scale))
    ax.set_ylabel(ylabel)
    ax.set_ylim(bottom=0)
    if len(order) > 1:
        style.label_ends(ax, ends)
    ax.set_title(f"{TITLES[name]}: total by {per}")
    style.panel(ax, "a")

    # (b) totals by the main category, largest first
    main = MAIN_CATEGORY[name]
    rows = data["cats"][main]
    if main == "Deprivation":
        names = {
            "1.0": "1 most deprived",
            "2.0": "2",
            "3.0": "3",
            "4.0": "4",
            "5.0": "5 least deprived",
            "(missing)": "unknown",
        }
        rows = sorted(rows, key=lambda r: names.get(r[0], r[0]))
        labels = [names.get(k, k) for k, _ in rows]
        colors = [
            style.QUINTILE.get(int(float(k)), style.INK_3) if k != "(missing)" else "#c9c8c3"
            for k, _ in rows
        ]
    else:
        rows = rows[:12]
        labels = [label_of(str(k)) for k, _ in rows]
        colors = [style.CATEGORICAL[0]] * len(rows)
    ax = fig.add_subplot(gs[1, 0])
    total = sum(v for _, v in data["cats"][main])
    y = np.arange(len(rows))[::-1]
    ax.barh(y, [v for _, v in rows], color=colors, height=0.7)
    ax.set_yticks(y, labels)
    ax.tick_params(axis="y", labelsize=6.5, length=0)
    ax.set_xlim(0, max(v for _, v in rows) * 1.12)  # room for the share labels
    ax.xaxis.set_major_formatter(style.thousands(scale if scale > 1 else 1))
    ax.set_xlabel(
        f"{unit}, whole period"
        + (" (thousands)" if scale == 1000 else " (millions)" if scale == 1e6 else "")
    )
    for yy, (_k, v) in zip(y, rows, strict=True):
        ax.text(v, yy, f" {100 * v / total:.0f}%", va="center", fontsize=6, color=style.INK_2)
    ax.set_title(f"By {CATEGORY_NAMES.get(main, main.lower())}")
    style.panel(ax, "b")

    # (c) how large single rows are, as a cumulative distribution: the share of rows holding at
    # most x (whole-number counts make a histogram on a log axis uneven; this stays smooth)
    ax = fig.add_subplot(gs[1, 1])
    counts = np.sort(np.array(data["counts"], dtype=float))
    share = np.arange(1, len(counts) + 1) / len(counts)
    ax.step(counts, 100 * share, where="post", color=style.CATEGORICAL[0])
    ax.set_xscale("log")
    style.plain_log(ax)
    ax.set_xlim(left=0.8)
    ax.set_ylim(0, 102)
    ax.set_xlabel(f"{unit} in one row of the file (log scale)")
    ax.set_ylabel("Rows with at most this many (%)")
    for q, txt in ((0.5, "median"), (0.9, "90th percentile")):
        v = float(np.quantile(counts, q))
        ax.plot([v], [100 * q], "o", color=style.INK, markersize=3)
        ax.annotate(
            f"{txt}: {v:,.0f}",
            (v, 100 * q),
            xytext=(6, -2),
            textcoords="offset points",
            fontsize=6.5,
            color=style.INK_2,
            va="top",
        )
    ax.set_title("Size of single rows (rows above 0)")
    style.panel(ax, "c")

    files = ", ".join(Path(f).name for f in spec["files"])
    style.source(fig, style.SOURCE_PHS + f". File(s): {files}.")
    style.save(fig, stem)


def _period(p: str):
    """A month (YYYYMM), financial year (YYYY/YY) or year (YYYY) as a date for plotting.

    Args:
        p: The period as text.

    Returns:
        A date.
    """
    if "/" in p:
        return dt.date(int(p[:4]), 10, 1)  # middle of the financial year
    if len(p) == 6:
        return dt.date(int(p[:4]), int(p[4:]), 1)
    return dt.date(int(p), 7, 1)


def main() -> None:
    """Profile and chart every dataset."""
    out = (
        Path(sys.argv[1])
        if len(sys.argv) > 1
        else Path(f"results/{dt.date.today().isoformat()}-distributions")
    )
    out.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()
    for name, spec in DATASETS.items():
        data = profile(con, name, spec, out)
        chart(name, data, spec, out / name)
        print(f"{name}: {len(data['counts']):,} rows above 0, written")


if __name__ == "__main__":
    main()
