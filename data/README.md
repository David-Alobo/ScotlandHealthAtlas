# Data

Nothing in `data/raw/` or `data/external/` is committed; this file says where each part comes from.

## data/raw/data-viz-2026/ (the competition package)

"Telling Scotland's Health Story" data package, Public Health Scotland (K. Nicholson, 11/09/2026),
shared by The Data Lab for its data visualisation competition 2026: download link and password on
<https://thedatalab.com/data-visualisation-competition/>. Downloaded 14 November 2026 (323 MB zip).

| File | Contents |
|---|---|
| `data/A&E/Level_1_Activity.csv` | A&E attendances by month for 103 sites, with waiting-time measures, July 2007 to June 2026 |
| `data/A&E/Level_2_Demographics.csv` | A&E attendances by month for 14 health boards, by age, sex and deprivation quintile, January 2018 to June 2026 |
| `data/Unintentional_Injuries/Admissions.csv` | Emergency admissions for unintentional injuries by council area, age, sex, injury type and place, 2015/16 to 2024/25 |
| `data/Unintentional_Injuries/Deaths.csv` | Deaths from unintentional injuries, same breakdowns, 2015 to 2024 |
| `data/Prescribing/File_{A,B,C}_*.csv` | Community prescribing by month, dispensing location and BNF chapter, 2019 to May 2026 |
| `reference_data/Ref File prescription_cost_analysis_2025.ods` | Published prescription cost analysis for 2025 |

The package's own README (`data/raw/data-viz-2026/README.md`) describes every column.

## data/external/ (other open data, added as needed)

| File | Publisher | Source | Licence | Downloaded |
|---|---|---|---|---|
| `simd2020v2_datazone_lookup_2025.xlsx` | Scottish Government | [SIMD 2020v2 data zone look-up](https://www.gov.scot/publications/scottish-index-of-multiple-deprivation-2020v2-data-zone-look-up/) | Open Government Licence v3.0 | 14 Nov 2026 |
| `simd2020v2_postcode_lookup_2025.xlsx` | Scottish Government | [SIMD 2020v2 postcode look-up](https://www.gov.scot/publications/scottish-index-of-multiple-deprivation-2020v2-postcode-look-up/) | Open Government Licence v3.0 | 14 Nov 2026 |
| `dz2011/` | Scottish Government | [Data zone boundaries 2011](https://maps.gov.scot/ATOM/shapefiles/SG_DataZoneBdry_2011.zip) (shapefile, British National Grid) | Open Government Licence v3.0 | 14 Nov 2026 |
| `nrs_sape_2011dz/` rebased mid-2011 to mid-2021 (corrected) | National Records of Scotland | [Rebased small area population estimates 2011-2021 (2011 data zones)](https://www.nrscotland.gov.uk/publications/rebased-small-area-population-estimates-for-2011-to-2021-2011-data-zones) | Open Government Licence v3.0 | 14 Nov 2026 |
| `gp/nes-gpws-2025.html` | NHS Education for Scotland | [General Practice Workforce Survey 2025](https://turasdata.nes.nhs.scot/data-and-reports/official-workforce-statistics/all-official-statistics-publications/general-practice-workforce-survey-2025/) (Tables 5, 6 and 8: GPs by board, over time, and by SIMD quintile of the practice, 31 March 2025) | Official statistics in development; reuse terms to confirm with NES before publication | 15 Nov 2026 |
| `gp/practice_contactdetails_apr2025.csv` | Public Health Scotland | [GP practices and list sizes, April 2025](https://www.opendata.nhs.scot/dataset/gp-practice-contact-details-and-list-sizes/resource/f3633113-9768-4676-8ed1-6695fe385bbe) (practice, list size, data zone, board) | Open Government Licence v3.0 | 15 Nov 2026 |
| `nrs_sape_2011dz/` mid-2023 and mid-2024 | National Records of Scotland | [Small area population estimates mid-2023 and mid-2024 (2011 data zones)](https://www.nrscotland.gov.uk/publications/small-area-population-estimates-mid-2023-and-mid-2024-2011-data-zones) | Open Government Licence v3.0 | 14 Nov 2026 |

The NHS open data portal (opendata.nhs.scot) was unreachable on 14 November 2026, so the official
publishers' own files were used. SIMD 2020v2 is on 2011 data zones, so the 2011-data-zone
population estimates are used to match it (mid-2022 is not published on them; see
`src/atlas/population.py`).

## data/derived/ (made by the pipeline, committed)

| File | Made by | Contents |
|---|---|---|
| `population_ae.csv` | `uv run python -m atlas.population` | Population by year (2011-2024), health board, council, SIMD quintile, urban-rural class, sex and A&E age band |
| `population_injury.csv` | same | The same with the injury files' age bands |
