"""Profile every file of the competition data package: columns, types, rows, gaps, ranges.

Usage (from the repository root): uv run python -m atlas.audit [output folder]

Writes `profile.md` (readable) and `profile.json` (every number) to the output folder, by default
results/<today>-data-audit/. Reads the CSV files with DuckDB, so nothing is loaded into memory
whole.
"""

from __future__ import annotations

import datetime as dt
import json
import sys
from pathlib import Path

import duckdb

RAW = Path("data/raw/data-viz-2026/data")
FILES = {
    "ae_activity": RAW / "A&E/Level_1_Activity.csv",
    "ae_demographics": RAW / "A&E/Level_2_Demographics.csv",
    "injury_admissions": RAW / "Unintentional_Injuries/Admissions.csv",
    "injury_deaths": RAW / "Unintentional_Injuries/Deaths.csv",
    "prescribing_a": RAW / "Prescribing/File_A_2019-21.csv",
    "prescribing_b": RAW / "Prescribing/File_B_2022-24.csv",
    "prescribing_c": RAW / "Prescribing/File_C_2025-26.csv",
}
FEW = 25  # columns with at most this many distinct values have them all listed


def profile(con: duckdb.DuckDBPyConnection, name: str, path: Path) -> dict:
    """Profile one CSV file.

    Args:
        con: A DuckDB connection.
        name: A short name for the file.
        path: The file.

    Returns:
        The profile: rows, and per column its type, distinct and missing counts, minimum,
        maximum, and (for columns with few values) every value with its row count.
    """
    con.execute(
        f"CREATE OR REPLACE VIEW t AS SELECT * FROM read_csv('{path.as_posix()}', "
        "header=true, sample_size=-1)"
    )
    rows = con.execute("SELECT count(*) FROM t").fetchone()[0]
    columns = []
    for col, typ, *_ in con.execute("DESCRIBE t").fetchall():
        q = f'"{col}"'
        distinct, missing, lo, hi = con.execute(
            f"SELECT count(DISTINCT {q}), count(*) - count({q}), min({q})::VARCHAR, "
            f"max({q})::VARCHAR FROM t"
        ).fetchone()
        entry = {
            "name": col,
            "type": typ,
            "distinct": distinct,
            "missing": missing,
            "min": lo,
            "max": hi,
        }
        if distinct <= FEW:
            entry["values"] = [
                [str(v), n]
                for v, n in con.execute(
                    f"SELECT {q}::VARCHAR, count(*) FROM t GROUP BY 1 ORDER BY 1"
                ).fetchall()
            ]
        columns.append(entry)
    return {"name": name, "file": path.as_posix(), "rows": rows, "columns": columns}


def to_markdown(profiles: list[dict]) -> str:
    """The profiles as a readable report.

    Args:
        profiles: From `profile`.

    Returns:
        Markdown text.
    """
    out = ["# Data audit: the competition package\n"]
    for p in profiles:
        out.append(f"## {p['name']}: `{p['file']}`\n\n{p['rows']:,} rows\n")
        out.append("| Column | Type | Distinct | Missing | Min | Max |")
        out.append("|---|---|---|---|---|---|")
        for c in p["columns"]:
            cut = lambda s: (s or "")[:40].replace("|", "/")  # noqa: E731
            out.append(
                f"| {c['name']} | {c['type']} | {c['distinct']:,} | {c['missing']:,} | "
                f"{cut(c['min'])} | {cut(c['max'])} |"
            )
        for c in p["columns"]:
            if "values" in c:
                vals = ", ".join(f"{v} ({n:,})" for v, n in c["values"])
                out.append(f"\n- **{c['name']}**: {vals}")
        out.append("\n")
    return "\n".join(out)


def main() -> None:
    """Profile all files and write the report."""
    out = (
        Path(sys.argv[1])
        if len(sys.argv) > 1
        else Path(f"results/{dt.date.today().isoformat()}-data-audit")
    )
    out.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()
    profiles = [profile(con, name, path) for name, path in FILES.items()]
    (out / "profile.json").write_text(json.dumps(profiles, indent=1), encoding="utf-8")
    (out / "profile.md").write_text(to_markdown(profiles), encoding="utf-8")
    print(f"wrote {out}/profile.md and profile.json")


if __name__ == "__main__":
    main()
