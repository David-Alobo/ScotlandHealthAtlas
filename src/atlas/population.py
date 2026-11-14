"""Population denominators: data zone estimates, grouped to match the health data's age bands.

Usage (from the repository root): python -m src.atlas.population

Reads National Records of Scotland small area population estimates on 2011 data zones (mid-2011
to mid-2021 rebased and corrected in 2026; mid-2023 and mid-2024) and the SIMD 2020v2 data zone
lookup, and writes two tables to data/derived/:

- population_ae.csv: year, health board, council, SIMD 2020v2 quintile, urban-rural class, sex and
  the A&E age bands (Under 18, 18-24, 25-39, 40-64, 65-74, 75 plus), with the population.
- population_injury.csv: the same with the injury files' age bands (0-4 ... 75plus years).

Mid-2022 is not published on 2011 data zones: it is filled as the mean of mid-2021 and mid-2023
for each data zone, sex and age, and flagged in the `estimated` column.
"""

from __future__ import annotations

import csv
from collections import defaultdict
from pathlib import Path

import openpyxl

EXT = Path("data/external")
SAPE = EXT / "nrs_sape_2011dz"
REBASED = (
    SAPE / "NRS - SAPE - 2011-22 rebase (11DZ) - REVISED syoa data for website"
    / "rebased-sape-2011-21-corrected"
)
LOOKUP = EXT / "simd2020v2_datazone_lookup_2025.xlsx"
OUT = Path("data/derived")

AE_BANDS = [(0, 17, "Under 18"), (18, 24, "18-24"), (25, 39, "25-39"), (40, 64, "40-64"),
            (65, 74, "65-74"), (75, 200, "75 plus")]
INJURY_BANDS = [(0, 4, "0-4 years"), (5, 9, "5-9 years"), (10, 14, "10-14 years"),
                (15, 24, "15-24 years"), (25, 44, "25-44 years"), (45, 64, "45-64 years"),
                (65, 74, "65-74 years"), (75, 200, "75plus years")]


def band(age: int, bands: list[tuple[int, int, str]]) -> str:
    """The name of the band an age falls in.

    Args:
        age: Age in years (90 stands for 90 and over).
        bands: (lowest, highest, name) for each band.

    Returns:
        The band's name.
    """
    return next(name for lo, hi, name in bands if lo <= age <= hi)


def lookup() -> dict[str, dict]:
    """The SIMD 2020v2 data zone lookup: quintile, board, council and urban-rural class.

    Returns:
        By data zone code: quintile, hb, council and urban_rural.
    """
    ws = openpyxl.load_workbook(LOOKUP, read_only=True)["SIMD 2020v2 DZ lookup data"]
    rows = ws.iter_rows(values_only=True)
    head = list(next(rows))
    i = {name: head.index(name) for name in head}
    out = {}
    for r in rows:
        if not r[0]:
            continue
        out[r[0]] = {
            "quintile": r[i["SIMD2020v2_Quintile"]],
            "hb": "NHS " + r[i["HBname"]],
            "council": r[i["LAname"]],
            "urban_rural": r[i["URname"]],
        }
    return out


def ages(head: list) -> list[tuple[int, int]]:
    """The columns holding single years of age.

    Args:
        head: The header row.

    Returns:
        (column index, age) for ages 0 to 90 (90 meaning 90 and over).
    """
    out = []
    for j, name in enumerate(head):
        if isinstance(name, str) and name.startswith("Age "):
            out.append((j, int(name.split()[1])))
    return out


def read_rebased(year: int) -> dict[tuple[str, str], list[int]]:
    """One year of the rebased 2011-2021 estimates.

    Args:
        year: 2011 to 2021.

    Returns:
        By (data zone, "Male" or "Female"): the population at each age 0 to 90.
    """
    ws = openpyxl.load_workbook(REBASED / f"Rebased SAPE {year} (11DZ) - corrected.xlsx",
                                read_only=True)[str(year)]
    out = {}
    head = None
    for r in ws.iter_rows(values_only=True):
        if head is None:
            if r[0] == "Data zone code":
                head = list(r)
                cols = ages(head)
                sex_col = head.index("Sex")
            continue
        sex = {"Males": "Male", "Females": "Female"}.get(r[sex_col])
        if sex and r[0]:
            out[(r[0], sex)] = [int(r[j]) for j, _ in cols]
    return out


def read_recent(year: int) -> dict[tuple[str, str], list[int]]:
    """One year of the mid-2023 or mid-2024 estimates (a sheet per sex).

    Args:
        year: 2023 or 2024.

    Returns:
        By (data zone, "Male" or "Female"): the population at each age 0 to 90.
    """
    wb = openpyxl.load_workbook(SAPE / f"small-area-population-estimates-mid-{year}-11-dz.xlsx",
                                read_only=True)
    out = {}
    for sheet, sex in (("Males", "Male"), ("Females", "Female")):
        head = None
        for r in wb[sheet].iter_rows(values_only=True):
            if head is None:
                if r[0] == "Data zone code":
                    head = list(r)
                    cols = ages(head)
                continue
            if r[0]:
                out[(r[0], sex)] = [int(r[j]) for j, _ in cols]
    return out


def main() -> None:
    """Build both population tables."""
    OUT.mkdir(parents=True, exist_ok=True)
    zones = lookup()
    years: dict[int, dict] = {y: read_rebased(y) for y in range(2011, 2022)}
    years[2023] = read_recent(2023)
    years[2024] = read_recent(2024)
    years[2022] = {
        k: [(a + b) / 2 for a, b in zip(years[2021][k], years[2023][k], strict=True)]
        for k in years[2021]
    }
    missing = sorted({dz for y in years.values() for dz, _ in y} - set(zones))
    if missing:
        raise SystemExit(f"{len(missing)} data zones not in the SIMD lookup, e.g. {missing[:3]}")
    for name, bands in (("population_ae.csv", AE_BANDS), ("population_injury.csv", INJURY_BANDS)):
        totals: dict[tuple, float] = defaultdict(float)
        for year, data in years.items():
            for (dz, sex), counts in data.items():
                z = zones[dz]
                for age, n in enumerate(counts):
                    key = (year, z["hb"], z["council"], z["quintile"], z["urban_rural"], sex,
                           band(age, bands))
                    totals[key] += n
        with (OUT / name).open("w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["year", "hb", "council", "simd_quintile", "urban_rural", "sex", "age_band",
                        "population", "estimated"])
            for key in sorted(totals):
                w.writerow([*key, round(totals[key], 1), int(key[0] == 2022)])
        print(f"wrote {OUT / name}: {len(totals):,} rows")
    for year in sorted(years):
        print(year, f"{sum(sum(c) for c in years[year].values()):,.0f}")


if __name__ == "__main__":
    main()
