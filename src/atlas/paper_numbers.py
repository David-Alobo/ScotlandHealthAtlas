"""Write the numbers the paper quotes, from the saved results tables, as LaTeX macros and tables.

Usage (from the repository root): uv run python -m atlas.paper_numbers

Every number in the paper's text comes from paper/generated/numbers.tex (one macro each) or from
a generated table, never typed by hand, so a rerun of the analysis updates the paper. Reads only
committed tables (through atlas.export_web). Writes paper/generated/numbers.tex and
paper/generated/table_*.tex.
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

from .export_web import ACCESS, AE, INJ, RX, read, story
from .stats import spearman

OUT = Path("paper/generated")
VALIDATION = Path("results/2026-11-14-validation/validation.csv")
FIELDS = Path("results/2026-11-15-fields")


def pct(x: float, digits: int = 0) -> str:
    """A fraction as a percentage string without the sign: 0.371 -> "37"."""
    return f"{100 * x:.{digits}f}"


def half_up(x: float, digits: int = 1) -> str:
    """A number rounded with halves up, as the atlas shows it: 6.35 -> "6.4"."""
    return str(Decimal(str(x)).quantize(Decimal(1).scaleb(-digits), rounding=ROUND_HALF_UP))


def num(x: float, digits: int = 0) -> str:
    """A number with thousands separators (LaTeX-safe): 1652428 -> "1{,}652{,}428"."""
    return f"{x:,.{digits}f}".replace(",", "{,}")


def macros() -> dict[str, str]:
    """Every number the paper's text uses, by macro name (letters only, as LaTeX needs).

    Returns:
        Macro name -> its text.
    """
    s = story()
    m: dict[str, str] = {}

    # data and neighbourhoods
    dz = s["deprived_zones"]
    gl = dz["by_council"]["Glasgow City"]
    m |= {
        "zonesTotal": num(dz["total"]),
        "zonesQone": num(dz["total_q1"]),
        "glasgowQone": num(gl["q1"]),
        "glasgowQonePct": pct(gl["q1"] / gl["zones"]),
        "glasgowShareOfQone": pct(gl["q1"] / dz["total_q1"]),
        "aeAttendances": num(s["hero"]["ae_attendances"]["value"]),
        "aeYear": s["hero"]["ae_attendances"]["period"],
        "itemsMillions": f"{s['hero']['prescription_items']['value'] / 1e6:.1f}",
    }

    # A&E by deprivation
    ae = s["ae"]
    last = len(ae["years"]) - 1
    q1, q5 = ae["quintiles"][0]["rate"], ae["quintiles"][4]["rate"]
    ratios = [a / b for a, b in zip(q1, q5, strict=True)]
    sens = read(AE / "gap_sensitivity.csv")
    m |= {
        "aeFirstYear": str(ae["years"][0]),
        "aeLastYear": str(ae["years"][last]),
        "aeQone": num(q1[last]),
        "aeQfive": num(q5[last]),
        "aeRatio": f"{float(sens[-1]['ratio_as_published']):.2f}",
        "aeRatioMin": f"{min(ratios):.2f}",
        "aeRatioMax": f"{max(ratios):.2f}",
        "aeRatioFirst": f"{float(sens[0]['ratio_as_published']):.2f}",
        "aeRatioExcess": f"{float(sens[-1]['ratio_excess_unknown_to_q1']):.2f}",
        "aeRatioFloor": f"{float(sens[-1]['ratio_all_unknown_to_q5']):.2f}",
        "aeRatioCeiling": f"{float(sens[-1]['ratio_all_unknown_to_q1']):.2f}",
        "unknownFirst": pct(float(sens[0]["unknown_deprivation_share"]), 2),
        "unknownLast": pct(float(sens[-1]["unknown_deprivation_share"]), 1),
    }
    unknown = [float(r["unknown_deprivation_share"]) for r in (sens[0], sens[-1])]
    m["unknownFold"] = f"{unknown[1] / unknown[0]:.0f}"
    type1 = [float(r["ratio_q1_q5"]) for r in read(AE / "gap.csv") if r["scope"] == "type1"]
    m |= {"aeTypeoneMin": f"{min(type1):.2f}", "aeTypeoneMax": f"{max(type1):.2f}"}

    # injuries: national trend, age profile, admissions
    t = s["death_trend"]
    peak = t["poisoning"]["deaths"].index(max(t["poisoning"]["deaths"]))
    m |= {
        "trendFirst": str(t["years"][0]),
        "trendLast": str(t["years"][-1]),
        "poisonFirst": num(t["poisoning"]["deaths"][0]),
        "poisonPeak": num(t["poisoning"]["deaths"][peak]),
        "poisonPeakYear": str(t["years"][peak]),
        "poisonLast": num(t["poisoning"]["deaths"][-1]),
        "poisonRateFirst": f"{t['poisoning']['rate'][0]:.1f}",
        "poisonRatePeak": f"{t['poisoning']['rate'][peak]:.1f}",
        "poisonRateLast": f"{t['poisoning']['rate'][-1]:.1f}",
        "fallsFirst": num(t["falls"]["deaths"][0]),
        "fallsLast": num(t["falls"]["deaths"][-1]),
        "fallsRateFirst": f"{t['falls']['rate'][0]:.1f}",
        "fallsRateLast": f"{t['falls']['rate'][-1]:.1f}",
        "fallsRateRise": pct(t["falls"]["rate"][-1] / t["falls"]["rate"][0] - 1),
    }
    a = s["injury_ages"]
    d = a["deaths"]

    def share(counts: list[int], bands: list[str]) -> float:
        return sum(c for c, b in zip(counts, a["bands"], strict=True) if b in bands) / sum(counts)

    m |= {
        "agePeriod": d["period"],
        "fallsDeathsYear": num(d["falls_total"]),
        "poisonDeathsYear": num(d["poisoning_total"]),
        "fallsOldShare": pct(share(d["falls"], ["75+"])),
        "poisonMidShare": pct(share(d["poisoning"], ["25-44", "45-64"])),
        "fallsWomenShare": pct(1 - d["falls_male_share"]),
        "poisonMenShare": pct(d["poisoning_male_share"]),
    }
    nat = read(INJ / "national.csv")
    adm = [r for r in nat if r["dataset"] == "admissions"]
    all_adm = [r for r in adm if r["injury_type"] == "All types"]
    falls_adm = [r for r in adm if r["injury_type"] == "Falls"]
    m |= {
        "admFirstYear": all_adm[0]["year"],
        "admLastYear": all_adm[-1]["year"],
        "admRateFirst": num(float(all_adm[0]["rate"])),
        "admRateLast": num(float(all_adm[-1]["rate"])),
        "admEventsLast": num(int(all_adm[-1]["events"])),
        "fallsAdmShare": pct(int(falls_adm[-1]["events"]) / int(all_adm[-1]["events"])),
    }
    ages = [r for r in read(INJ / "age_falls.csv") if r["dataset"] == "admissions"]
    lastyr = ages[-1]["year"]
    rate = {r["age_band"]: r for r in ages if r["year"] == lastyr}
    under = [
        r
        for r in ages
        if r["year"] == lastyr and r["age_band"] not in ("65-74 years", "75plus years")
    ]
    first = {r["age_band"]: r for r in ages if r["year"] == ages[0]["year"]}
    m |= {
        "fallsOldRateFirst": num(float(first["75plus years"]["rate_per_100000"])),
        "fallsMidRate": num(float(rate["65-74 years"]["rate_per_100000"])),
        "fallsOldRate": num(float(rate["75plus years"]["rate_per_100000"])),
        "fallsYoungRate": num(
            1e5 * sum(int(r["falls"]) for r in under) / sum(int(r["population"]) for r in under)
        ),
    }

    # councils
    cs = s["councils"]["councils"]
    above = [c for c in cs if c["vs"] == "above"]
    below = [c for c in cs if c["vs"] == "below"]
    falls_above = [c for c in cs if c["falls_vs"] == "above"]
    falls_below = [c for c in cs if c["falls_vs"] == "below"]
    mean = lambda xs: sum(c["share_q1"] for c in xs) / len(xs)  # noqa: E731
    eco = {
        (r["dataset"], r["injury_type"]): float(r["spearman_rho"])
        for r in read(INJ / "ecological.csv")
    }
    few = [c for c in cs if sum(c["deaths_poisoning"]) < 20]
    m |= {
        "councilPeriod": s["councils"]["period"],
        "fallsPeriod": s["councils"]["falls_period"],
        "scotPoison": f"{s['councils']['scotland']:.1f}",
        "scotFalls": num(s["councils"]["scotland_falls"]),
        "aboveCount": str(len(above)),
        "belowCount": str(len(below)),
        "aboveQone": pct(mean(above)),
        "belowQone": pct(mean(below)),
        "fallsAboveCount": str(len(falls_above)),
        "fallsBelowCount": str(len(falls_below)),
        "fallsAboveQone": pct(mean(falls_above)),
        "fallsBelowQone": pct(mean(falls_below)),
        "rhoPoison": f"{eco[('deaths', 'Poisoning')]:.2f}",
        "rhoAllDeaths": f"{eco[('deaths', 'All types')]:.2f}",
        "rhoFalls": f"{eco[('admissions', 'Falls')]:.2f}",
        "rhoAllAdm": f"{eco[('admissions', 'All types')]:.2f}",
        "fewCount": str(len(few)),
        "fewNames": ", ".join(sorted(c["council"] for c in few)),
    }

    # prescribing
    chap = {r["chapter"]: r for r in read(RX / "chapters.csv")}
    quint = {r["simd_quintile"]: r for r in read(RX / "quintile.csv")}
    unplaced = quint["unplaced"]
    rx_councils = read(RX / "council.csv")
    rho_items = spearman(
        [float(r["items_per_person"]) for r in rx_councils],
        [float(r["share_simd_q1"]) for r in rx_councils],
    )
    m |= {
        "itemsQone": f"{float(quint['1']['items_per_person']):.1f}",
        "itemsQfive": f"{float(quint['5']['items_per_person']):.1f}",
        "pharmQone": f"{float(quint['1']['pharmacies_per_10000']):.1f}",
        "pharmQfive": f"{float(quint['5']['pharmacies_per_10000']):.1f}",
        "rhoItems": f"{rho_items:.2f}",
        "cnsQone": pct(float(chap["Central nervous system"]["share_q1"]), 1),
        "cnsQfive": pct(float(chap["Central nervous system"]["share_q5"]), 1),
        "respQone": pct(float(chap["Respiratory system"]["share_q1"]), 1),
        "respQfive": pct(float(chap["Respiratory system"]["share_q5"]), 1),
        "cardioQone": pct(float(chap["Cardiovascular system"]["share_q1"]), 1),
        "cardioQfive": pct(float(chap["Cardiovascular system"]["share_q5"]), 1),
        "unplacedShare": pct(float(unplaced["share_of_items"]), 1),
    }

    # validation against PHS publications
    v = {r["id"]: r for r in read(VALIDATION)}
    worst = max(abs(float(r["difference_pct"])) for r in v.values())
    m |= {
        "valDeaths": num(float(v["deaths_2023"]["value"])),
        "valAdmPub": num(float(v["admissions_2023_24"]["value"])),
        "valAdmOurs": num(float(v["admissions_2023_24"]["ours"])),
        "valAdmDiff": f"{float(v['admissions_2023_24']['difference_pct']):.1f}",
        "valAdmLateDiff": f"{abs(float(v['over65_admissions_2024_25']['difference_pct'])):.1f}",
        "valWorst": f"{worst:.1f}",
        "oldFallsShare": f"{float(v['over65_falls_share']['ours']):.0f}",
        "valCount": str(len(v)),
    }

    # access to care: emergency department waits, and GP time per patient
    w = s["access"]["waits"]
    y19 = w["years"].index(2019)
    met = [y for y, v in zip(w["years"], w["within_4h"], strict=True) if v >= w["target"]]
    q = {r["quintile"]: r for r in s["access"]["gp"]["quintiles"]}
    boards = read(ACCESS / "gp_board.csv")
    scen = {r["scenario"]: r for r in read(ACCESS / "gp_scenarios.csv")}
    close = [r for r in boards if r["health_board"] != "Scotland"]
    m |= {
        "waitsFirstYear": str(w["years"][0]),
        "waitsLastYear": str(w["years"][-1]),
        "waitsFirst": pct(w["within_4h"][0], 1),
        "waitsNineteen": pct(w["within_4h"][y19], 1),
        "waitsLast": pct(w["within_4h"][-1], 1),
        "waitsLastMet": str(max(met)),
        "overEightLast": pct(w["over_8h"][-1], 1),
        "overTwelveFirst": pct(w["over_12h"][0], 2),
        "overTwelveLast": pct(w["over_12h"][-1], 1),
        "overTwelveVisits": num(round(w["over_12h"][-1] * w["attendances"][-1], -3)),
        # halves round up, as the atlas rounds them (6.35 -> 6.4)
        "gpHeadQone": half_up(q[1]["headcount_per_10000"]),
        "gpHeadQfive": half_up(q[5]["headcount_per_10000"]),
        "gpWteQone": half_up(q[1]["wte_per_10000"]),
        "gpWteQfive": half_up(q[5]["wte_per_10000"]),
        "gpWteGap": pct(1 - q[1]["wte_per_10000"] / q[5]["wte_per_10000"]),
        "gpPatients": num(sum(r["patients"] for r in q.values())),
        "gpBoardsClose": str(
            sum(
                abs(float(r["wte_per_10000"]) - float(r["nes_wte_per_10000"])) <= 0.05
                for r in close
            )
        ),
        "gpBoardWorst": f"{s['access']['gp']['board_check_max_difference']:.2f}",
        "gpQonePerGp": num(q[1]["patients"] / q[1]["gp_headcount"]),
        "gpQfivePerGp": num(q[5]["patients"] / q[5]["gp_headcount"]),
        "gpQonePerWte": num(q[1]["patients"] / q[1]["gp_wte"]),
        "gpQfivePerWte": num(q[5]["patients"] / q[5]["gp_wte"]),
        "gpScenGap": half_up(
            100 * float(scen["quintile 1 GPs work quintile 5's mean WTE"]["gap_to_q5"])
        ),
        "gpScenExtra": num(float(scen["quintile 1 GPs work quintile 5's mean WTE"]["extra_wte"])),
        "gpScenSessions": num(
            float(scen["quintile 1 GPs work quintile 5's mean WTE"]["extra_sessions_a_week"])
        ),
    }

    # two more fields: where injuries happen, and what medicines cost
    loc = read(FIELDS / "location.csv")
    share = {(r["dataset"], r["injury_type"], r["location"]): r for r in loc}
    cost = {(r["simd_quintile"], r["chapter"]): r for r in read(FIELDS / "cost.csv")}
    m |= {
        "fallsDeathsUnplaced": pct(
            float(share[("deaths", "Falls", "Unspecified place")]["share_of_all"])
        ),
        "poisonDeathsHome": pct(float(share[("deaths", "Poisoning", "Home")]["share_of_all"])),
        "fallsAdmHomePlaced": pct(float(share[("admissions", "Falls", "Home")]["share_of_placed"])),
        "costQone": f"{float(cost[('1', 'All')]['cost_per_item']):.2f}",
        "costQfive": f"{float(cost[('5', 'All')]['cost_per_item']):.2f}",
        "costMidLow": f"{min(float(cost[(str(k), 'All')]['cost_per_item']) for k in range(1, 5)):.2f}",  # noqa: E501
    }
    return m


def table_validation() -> str:
    """LaTeX rows of the comparison with PHS's published figures."""
    rows = []
    for r in read(VALIDATION):
        what = r["what"].replace("&", r"\&").replace("%", r"\%")
        pub = float(r["value"])
        ours = float(r["ours"])
        is_share = "(%)" in r["what"] or "EASR" in r["what"]
        fmt = (lambda x: f"{x:.1f}") if is_share else (lambda x: num(x))
        diff = float(r["difference_pct"])
        rows.append(f"{what} & {fmt(pub)} & {fmt(ours)} & {diff:+.1f} \\\\")
    return "\n".join(rows) + "\n"


def table_councils() -> str:
    """LaTeX rows: councils clearly above Scotland's poisoning death rate."""
    cs = [c for c in story()["councils"]["councils"] if c["vs"] == "above"]
    rows = []
    for c in sorted(cs, key=lambda c: -c["rate"]):
        rows.append(
            f"{c['council']} & {c['rate']:.1f} & {c['lower']:.1f}--{c['upper']:.1f} & "
            f"{pct(c['share_q1'])} & {c['falls_rate']:.0f} \\\\"
        )
    return "\n".join(rows) + "\n"


def main() -> None:
    """Write the macros and tables."""
    OUT.mkdir(parents=True, exist_ok=True)
    m = macros()
    lines = ["% Generated by `uv run python -m atlas.paper_numbers`: do not edit by hand.\n"]
    lines += [f"\\newcommand{{\\{k}}}{{{v}}}\n" for k, v in m.items()]
    (OUT / "numbers.tex").write_text("".join(lines), encoding="utf-8")
    (OUT / "table_validation.tex").write_text(table_validation(), encoding="utf-8")
    (OUT / "table_councils.tex").write_text(table_councils(), encoding="utf-8")
    print(f"wrote {len(m)} macros and 2 tables to {OUT}")


if __name__ == "__main__":
    main()
