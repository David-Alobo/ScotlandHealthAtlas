# Two more fields: where injuries happen, and what medicines cost (15 November 2026)

Made with `uv run python -m atlas.fields results/2026-11-15-fields` (code: `src/atlas/fields.py`).
Added after a review comment asked what else the competition data's fields could show.

## Files

| File | What |
|---|---|
| `location.csv` | Deaths (2020 to 2024) and emergency admissions (2020/21 to 2024/25) after falls and poisoning, by recorded place: events, share of all, share of those with a place recorded |
| `cost.csv` | Gross ingredient cost per item by SIMD 2020v2 quintile of the dispensing location, all medicines and by chapter, June 2025 to May 2026 |

## Results

**Where injuries happen.** The place is often not recorded, so the field supports only some
statements:

- Deaths after a fall: the place is unspecified for 82.1% (4,561 of 5,555). The field cannot say
  where fatal falls happen.
- Poisoning deaths: 86.9% are recorded at home (96.3% of those with a place).
- Emergency admissions after a fall: 46.9% at home, 33.4% unspecified; of those with a place,
  70.5% at home, 8.6% in the street and 8.0% in a residential institution.
- Emergency admissions for poisoning: 65.2% unspecified; of those with a place, 85.1% at home.

**What medicines cost.** Gross ingredient cost per item is similar across the quintiles of the
dispensing location (£10.57 to £11.00 in quintiles 1 to 4) and highest in the least deprived
(£12.21). Within chapters the least deprived quintile also costs more per item in 13 of 21 chapters
(for example the central nervous system, £9.55 against £8.13 in the most deprived). Cost is
recorded where medicines are dispensed, not where patients live, and 1.4% of items cannot be
placed.

Neither result is shown in the atlas: the injury place is too often missing to map, and the cost
difference is small beside the differences the atlas shows. Both are reported in the paper's
supplementary results.
