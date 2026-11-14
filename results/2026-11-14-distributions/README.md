# Distributions of every dataset (14 November 2026)

Made with `python -m src.atlas.distributions results/2026-11-14-distributions`. Figures use the
shared publication style (`src/atlas/style.py`): double-column width, validated colour-blind-safe
colours, labelled axes with units, data source on the figure; each saved as PDF, SVG and 300-dpi
PNG.

Unlike the audit, totals here are **weighted by what each row counts** (attendances, admissions,
deaths, prescription items), not by rows.

## Files

For each dataset (`ae_activity`, `ae_demographics`, `injury_admissions`, `injury_deaths`,
`prescribing`):

| File | Contents |
|---|---|
| `<dataset>_numeric.csv` | Percentiles 1-99, mean, share of zeros and missing values for every numeric column |
| `<dataset>_time.csv` | Total by month or year (and by site type or injury type where present) |
| `<dataset>_by_<column>.csv` | Total and share for every value of each category column |
| `<dataset>.pdf/.svg/.png` | (a) total over time, (b) totals by the main category, (c) the cumulative distribution of single rows |

## What the distributions show

- **A&E activity, 2007 to 2026**: about 105,000-125,000 emergency department attendances a month
  before 2020, a fall to about 57,000 in April 2020, and a return to 2019 levels by 2024-2026.
  Minor injury units add about 15,000-28,000 a month. Greater Glasgow and Clyde accounts for 27%
  of all attendances, Lothian 16%, Lanarkshire 12%.
- **Waiting times are skewed**: in half of the site-month rows, 99.5% or more were seen within 4
  hours (many rows are small units), but the bottom 5% of rows saw 71.5% or fewer within 4 hours;
  over-12-hour waits are zero in 72% of rows with episode data and reach 12.2% at the 99th
  percentile. Site-month rows are not patients: any waiting-time story must weight by attendances.
- **A&E demographics, 2018 to 2026**: by deprivation, 26% of attendances come from the most
  deprived fifth of postcodes and 14% from the least deprived (4% unknown); see
  `../2026-11-14-ae-deprivation` for rates. Ages 40-64 make up 27%, under-18s 22%, 75 and over 14%.
- **Injury admissions**: falls are 64% of emergency admissions for unintentional injury, steady at
  about 35,000-38,000 a year; people aged 75 and over account for 34% of admissions.
- **Injury deaths**: poisoning (42%) has overtaken falls (40%) as the largest cause of death from
  unintentional injury over 2015-2024: **a different pattern from admissions**, worth its own look.
- **The injury files are mostly zeros**: 69% of admission rows and 82% of death rows are 0 (a full
  grid of council x age x sex x type x place). Small counts in single rows mean any council-level
  breakdown needs pooling over years or categories, and care with disclosure-style small numbers.
- **Prescribing**: about 8-10 million items a month, rising slowly from 2019 to 2026, with a regular
  seasonal pattern. Cardiovascular (24%) and central nervous system (20%) medicines are 44% of all
  items. A pharmacy-month-chapter row holds a median of 146 items.
