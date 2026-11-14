# Community prescribing by the deprivation of where it is dispensed (14 November 2026)

Made with `uv run python -m atlas.prescribing results/2026-11-14-prescribing` (method in the
module's docstring). Period: **June 2025 to May 2026**, the latest twelve whole months.

## Method in brief

- **Counted where medicines are dispensed, not where patients live.** Each dispensing location's
  postcode is placed in its 2011 data zone with the SIMD 2020v2 postcode look-up (all 1,336
  postcodes matched), then in its SIMD quintile and council area.
- Items are divided by the mid-2024 population of the same quintile or council (all ages; the
  prescribing files carry no age, so these rates are **not age-standardised**).
- **Unplaced items**: 356 location codes have no address in any month of any file. Their share of
  items fell from 24% in 2019 to 2% in 2025 (1.4% in this period), so quintile comparisons use the
  latest twelve months only and the monthly series starts in January 2024.
- The medicine mix is compared as each chapter's share of a quintile's items, which needs no
  population and is not affected by where pharmacies cluster.

## Files

| File | Contents |
|---|---|
| `locations.csv` | Every location with an address: postcode, data zone, SIMD quintile, council, first and last month |
| `quintile.csv` | By quintile: locations, items, share, population, items per person, locations per 10,000 people (and unplaced items) |
| `chapters.csv` | By BNF chapter: share of each quintile's items, items per person by quintile, Q1:Q5 ratio |
| `council.csv` | By council: items, population, items per person, share of people in quintile 1 |
| `monthly.csv` | Items by month and quintile from January 2024, per 1,000 people |
| `quintiles.*` | (a) items per person and (b) locations per 10,000 people by quintile; (c) medicine mix, most vs least deprived |
| `councils.*` | Items per person by council against the share of people in the most deprived fifth |

## Findings (descriptive)

- 113.2 million items in the twelve months.
- **Most of the deprivation gradient in items per person is where pharmacies are.** Locations in
  the most deprived fifth of data zones dispensed 30.2 items per person living there, against 10.7
  in the least deprived fifth (2.8 times); but there are 3.2 locations per 10,000 people in the
  most deprived fifth against 1.4 in the least (2.3 times). Items per location differ less: 94,000
  in quintile 1, 78,000 in quintile 5. People in less deprived areas likely collect many
  prescriptions from pharmacies in town centres and shopping streets, which sit in more deprived
  data zones; this data cannot show it.
- **The mix differs**, and that comparison does not depend on where pharmacies are: central
  nervous system medicines are 21.2% of items dispensed in the most deprived fifth against 16.8% in
  the least; respiratory 7.8% against 6.6%; gastro-intestinal 10.5% against 9.8%. Cardiovascular
  (22.7% against 24.3%) and endocrine (8.8% against 10.1%) are lower in the most deprived fifth.
  The least deprived areas have older populations, which could explain the cardiovascular and
  endocrine difference; chapters are broad (antidepressants, opioids, epilepsy drugs and more sit
  in one chapter), so finer causes are not visible here.
- **Councils**: from 13.9 items per person (City of Edinburgh) to 27.1 (Inverclyde); Na h-Eileanan
  Siar (26.9) and Dumfries and Galloway (26.6) are near the top with few people in the most
  deprived fifth. Spearman's rho with the quintile-1 share is 0.40 (32 councils). Not
  age-standardised: older council populations receive more medicines.

## Open questions

- Every location with an address dispensed in this period, so the package seems to give addresses
  only to locations open now; yet some unaddressed codes still dispense in 2026. Are they another
  kind of dispenser (dispensing GP practices, appliance suppliers)? Worth asking PHS.
- An age adjustment needs patient age, which the files do not have; council age structure could be
  used for an indirect adjustment if the mix story goes ahead.
