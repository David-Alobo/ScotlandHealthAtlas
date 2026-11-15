# Access to care: A&E waits and GPs per patient (15 November 2026)

Made with `uv run python -m atlas.access results/2026-11-15-access` (code: `src/atlas/access.py`).
Added after review comments asked for the ratio of GPs to patients and for use of the fields in the
competition data not yet shown (the A&E activity file's waiting times).

## Files

| File | What |
|---|---|
| `waits.csv` | Per calendar year 2008-2025 and site type (Type 1 emergency departments; Type 3 minor injury units and other sites): attendances, share seen within 4 hours ("All" category), shares over 8 and over 12 hours ("Episode" measures) |
| `waits_board.csv` | Emergency departments by health board of the hospital, 2025 |
| `gp_quintile.csv` | Per SIMD 2020v2 quintile of the practice address: practices, registered patients (April 2025), GP headcount and whole-time equivalent (NES Table 8, 31 March 2025), and both per 10,000 patients |
| `gp_board.csv` | Per health board: NES GP headcount and WTE (Table 5), patients from the April 2025 list sizes, our rates per 10,000, and NES's own rates (the check) |
| `gp_ratios.csv` | Registered patients per GP and per full-time GP, by quintile and for Scotland |
| `gp_scenarios.csv` | Quintile 1 with longer GP hours (headcount held): its GPs at quintile 5's mean WTE, or enough to match quintile 5's GP time per patient; extra WTE and sessions a week (1 WTE = 8 sessions) |
| `gp_trend.csv` | NES Table 6: GP headcount and WTE in each survey year, 2013-2025 |
| `waits.pdf/.svg/.png`, `gp.pdf/.svg/.png` | Figures |

## Results

**Waiting in emergency departments** (Type 1 sites):

| | 2008 | 2019 | 2025 |
|---|---|---|---|
| Attendances | 1,365,153 | 1,440,285 | 1,408,982 |
| Within 4 hours | 97.6% | 87.4% | 65.0% |
| Over 8 hours | 0.16% | 1.5% | 12.3% |
| Over 12 hours | 0.03% | 0.35% | 5.3% |

The standard is 95% within 4 hours; emergency departments last met it as a calendar-year average
in 2011 (95.1%). In 2025 the share within 4 hours ranged by board from 48.2% (Forth Valley) to
93.5% (Orkney). Waits are recorded by hospital, not by where patients live, so they cannot be set
against deprivation.

**GPs per 10,000 registered patients, by deprivation of the practice's area** (31 March 2025):

| Quintile | Practices | Patients | GPs per 10,000 | WTE per 10,000 |
|---|---|---|---|---|
| 1 most deprived | 219 | 1,492,002 | 7.73 | 5.52 |
| 2 | 217 | 1,493,485 | 7.13 | 5.61 |
| 3 | 193 | 1,120,588 | 8.51 | 6.69 |
| 4 | 150 | 1,066,810 | 8.00 | 5.92 |
| 5 least deprived | 108 | 863,067 | 7.91 | 6.35 |

Practices in the most deprived fifth have about as many GPs per patient as those in the least
deprived (7.7 and 7.9), but 13% less GP time (5.5 against 6.4 WTE): NES reports a mean WTE of
0.71 for their GPs against 0.80. The pattern across the middle quintiles is not monotonic (the
third is highest), so this is a comparison of the two ends, not a gradient.

## Checks and cautions

- **Denominator check.** Our patients per board, from the April 2025 list sizes, reproduce NES's
  own WTE per 10,000 patients within 0.05 for 12 of the 14 boards; Grampian (5.81 against 5.7) and
  Shetland (8.85 against 8.6) differ by up to 0.25, presumably from the list-size date NES used.
- **How NES places practices in quintiles is not stated.** We assume by the data zone of the
  practice address, as the list-size file gives it. If NES used another rule (for example the
  patients' own deprivation), the quintile denominators would differ.
- GP headcounts by quintile sum to 4,709, more than the 4,582 GPs, because some GPs work in more
  than one practice; WTE sums exactly to 3,591.5. Specialty trainees and locums are excluded, as in
  NES's figures.
- Practices are compared, not patients: people need not live in their practice's area.

## Patients per GP, and longer hours (scenarios, not forecasts)

| | Patients per GP | Patients per full-time GP |
|---|---|---|
| Most deprived fifth | 1,293 | 1,810 |
| Least deprived fifth | 1,264 | 1,575 |
| Scotland | 1,317 | 1,681 |

If the GPs in the most deprived fifth worked the same mean hours as those in the least deprived
(0.80 WTE rather than 0.71), that fifth would gain 101.7 full-time GPs (814 sessions a week, 0.71 a
GP), and GP time per 10,000 patients would rise from 5.52 to 6.21, 2.3% below the least deprived
fifth (6.35) rather than 13%. Matching the least deprived fifth exactly would take 123.1 full-time
GPs more (985 sessions a week, 0.85 a GP).
