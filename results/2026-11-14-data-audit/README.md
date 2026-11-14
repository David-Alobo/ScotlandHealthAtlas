# Data audit of the competition package (14 November 2026)

Made with `uv run python -m atlas.audit results/2026-11-14-data-audit` (DuckDB 2.0.0). Every column
of every file is profiled in `profile.md` (readable) and `profile.json` (all numbers): type,
distinct values, missing values, range, and every value of columns with few of them.

## What each dataset can support

| Dataset | Rows | Covers | Breakdowns | Key strength |
|---|---|---|---|---|
| A&E activity (Level 1) | 39,744 | July 2007 to June 2026 (228 months) | 14 health boards, 87 named sites, Type 1 / Type 3, attendance category | 19 years of demand and waiting times (4, 8 and 12 hours) |
| A&E demographics (Level 2) | 139,269 | January 2018 to June 2026 (102 months) | 14 boards, Type 1 / 3, age (6 groups) x sex x deprivation quintile in the same row | Who attends, by deprivation of where they live |
| Injury admissions | 237,951 | 2015/16 to 2024/25 (financial years) | 32 council areas, age (8), sex, injury type (7), place (12) | A complete grid, zeros included |
| Injury deaths | 45,836 | 2015 to 2024 (calendar years) | as admissions | |
| Community prescribing | 2,354,062 (3 files) | January 2019 to May 2026 | 1,343+ dispensing locations with postcode, BNF chapter, month | Items, quantities and cost per place |

## Checks passed

- **The A&E demographics reconcile with the activity file.** For NHS Greater Glasgow and Clyde,
  Type 1 departments, June 2025: attendances summed over deprivation quintiles (including unknown)
  = 28,878 = the activity file's total for the same board, month and type (category All).
- In the demographics file, age, sex and deprivation are cross-tabulated in one row (120,129 rows
  have all three), so totals by any one of them can be summed without double counting.

## Cautions for any analysis

1. **A&E attendance categories overlap.** In the activity file, `All` = `Unplanned` + `New
   planned`; sum only `All` (or only the parts), never all three.
2. **Two A&E activity rows are impossible**: a negative "over 4 hours" count (minimum -27) and a
   percentage seen within 4 hours above 100 (139.1). They are to be excluded and reported.
3. **2,946 activity rows have no hospital name or address** (NHS Highland 1,360, Tayside 780,
   Grampian 738, Ayrshire and Arran 68): board totals include them; site-level maps cannot.
4. **Waiting-time detail (8 and 12 hours) exists only for sites with episode data** (16,926 rows
   without it, mostly minor injury units).
5. **Deprivation is unknown for 19,096 demographic rows** (about 2% of attendances in the check
   above); age and sex are missing for 2,188 rows. Shares by quintile should say so.
6. **Counts are not rates.** Comparing quintiles, boards or council areas needs population
   denominators (National Records of Scotland estimates by area, age, sex and deprivation).
7. **Injury categories differ from the package README**: admissions have no `All` injury type
   (7 types: Crushing, Falls, Other, Poisoning, RTI, Scalds, Struck by/against) and 12 places, not
   4; deaths call transport injuries "Land transport accidents" where admissions say "RTI".
8. **Prescribing is counted where medicines are dispensed, not where patients live**, and 24% of
   rows in 2019-21 (229,605), 13% in 2022-24 and 2% in 2025-26 have no dispensing address, health
   board or partnership (likely locations that have since closed). Any trend by area must handle
   these rows, or the trend will partly be the address coverage improving.
9. **BNF chapter 0 is "Missing"** (about 5% of rows), and chapter 14 (vaccines) is partial.

## Data to add first

- Population estimates by health board, council area, age, sex and deprivation quintile (National
  Records of Scotland), for rates.
- The Scottish Index of Multiple Deprivation 2020 with a postcode lookup, to give each dispensing
  location a deprivation quintile.
- Boundary files for health boards and council areas, for maps.
