# A&E attendance rates by deprivation, Scotland, 2018 to 2025 (first look, 14 November 2026)

Made with `uv run python -m atlas.population` (denominators) and `uv run python -m atlas.ae_deprivation`.
Exploratory: the first analysis of the project, to judge whether the inequality story holds.

## Method

- Attendances: A&E demographics file (Level 2), calendar years 2018 to 2025 (the whole years in
  the file), summed over all 14 boards, by SIMD 2020v2 quintile of the patient's postcode, age
  band and sex. Scope `all` = Type 1 and Type 3 sites; `type1` = emergency departments only.
- Population: NRS small area population estimates on 2011 data zones, grouped by SIMD 2020v2
  quintile, sex and the same age bands (`data/derived/population_ae.csv`). Mid-2022 is the mean of
  mid-2021 and mid-2023 (not published on 2011 data zones); 2025 uses mid-2024, the latest.
- Rates per 1,000 people, crude and directly standardised for age and sex to Scotland's mid-2024
  population. National rates, so attending a hospital in another board does not matter.
- Attendances with unknown deprivation, age or sex are left out of the quintile rates; their share
  is reported (`unknown_share` in `gap.csv`).

## Results (`rates.csv`, `gap.csv`, `rates.png`)

| Year | Most deprived (Q1) | Least deprived (Q5) | Ratio Q1 / Q5 | Unknown share |
|---|---|---|---|---|
| 2018 | 411.3 | 203.7 | 2.02 | 3.1% |
| 2019 | 429.0 | 211.8 | 2.03 | 3.0% |
| 2020 | 324.6 | 155.7 | 2.09 | 2.1% |
| 2021 | 365.8 | 176.3 | 2.08 | 2.5% |
| 2022 | 378.3 | 188.9 | 2.00 | 3.5% |
| 2023 | 373.8 | 187.1 | 2.00 | 4.2% |
| 2024 | 385.8 | 196.7 | 1.96 | 4.7% |
| 2025 | 380.2 | 199.9 | 1.90 | 5.3% |

Attendances per 1,000 people, all sites, standardised for age and sex.

- **People in Scotland's most deprived fifth of neighbourhoods attend A&E about twice as often as
  people in the least deprived fifth, of the same age and sex**, in every year from 2018 to 2025.
  At emergency departments alone the ratio is higher, 2.10 to 2.29.
- The gradient is steady across all five quintiles: each step towards more deprivation brings
  more attendances.
- All quintiles fell in 2020 (the pandemic) and recovered; none is back to its 2019 rate.
- The ratio drifts down from 2.03 (2019) to 1.90 (2025). **This may not be a real narrowing**:
  the share of attendances with unknown deprivation rose from 3.0% to 5.3% over the same years,
  and if those attendances come disproportionately from deprived areas, the fall is partly or
  wholly an artefact. To be checked before any claim about a trend.

## Limits

- Area-level deprivation describes where people live, not each person's circumstances.
- Attendances are visits, not people: one person can attend many times.
- 2022 and 2025 populations are estimated (see Method).
