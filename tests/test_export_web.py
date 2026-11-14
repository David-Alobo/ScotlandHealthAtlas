import csv
from pathlib import Path

import pytest

from atlas import export_web

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def story():
    # the exporter reads committed results tables, so it runs in CI without the raw data
    import os

    old = os.getcwd()
    os.chdir(ROOT)
    try:
        yield export_web.story()
    finally:
        os.chdir(old)


def test_hero_numbers_are_positive(story):
    for item in story["hero"].values():
        assert item["value"] > 0 and item["period"]


def test_ae_series_match_the_rates_table(story):
    with (ROOT / "results/2026-11-14-ae-deprivation/rates.csv").open(encoding="utf-8") as f:
        q1 = [
            float(r["standardised_per_1000"])
            for r in csv.DictReader(f)
            if r["scope"] == "all" and r["simd_quintile"] == "1"
        ]
    ae = story["ae"]
    assert ae["quintiles"][0]["rate"] == q1
    assert all(len(s["rate"]) == len(ae["years"]) for s in ae["quintiles"])


def test_injury_ages_are_aligned(story):
    ages = story["injury_ages"]
    for d in ("deaths", "admissions"):
        assert len(ages[d]["falls"]) == len(ages[d]["poisoning"]) == len(ages["bands"])
        assert 0 < ages[d]["poisoning_male_share"] < 1


def test_councils_have_valid_intervals(story):
    cs = story["councils"]["councils"]
    assert len(cs) == 32
    assert all(c["lower"] <= c["rate"] <= c["upper"] for c in cs)
    assert -1 <= story["councils"]["rho_poisoning_deaths"] <= 1


def test_medicine_shares_are_fractions(story):
    for c in story["medicines"]["chapters"]:
        assert 0 < c["q1"] < 1 and 0 < c["q5"] < 1
