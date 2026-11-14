# Unintentional injuries: rates over time, by council area and by deprivation (14 November 2026)

Made with `python -m src.atlas.injuries results/2026-11-14-injuries` (method in the module's
docstring). Emergency admissions 2015/16 to 2024/25 (financial years), deaths 2015 to 2024
(calendar years).

## Method in brief

- Rates per 100,000 people, **standardised for age and sex to the 2013 European Standard
  Population** (ESP2013, as PHS uses), with its 5-year bands summed to the files' eight age bands.
  Because the bands are coarser than PHS's own, the rates will differ slightly from published PHS
  figures; a check against them is still to do.
- 95% confidence intervals by the Dobson method (Byar's approximation for the count).
- Populations: NRS small area population estimates (`data/derived/population_injury.csv`); a
  financial year takes the mid-year population of the year it starts in; 2024/25 and 2024 use
  mid-2024.
- Council rates **pool the latest five years** (2020/21-2024/25; 2020-2024), since most single
  rows are zero. A council is "above" or "below" Scotland when its interval excludes the Scotland
  rate (32 comparisons, not corrected for multiplicity: read as descriptive).
- **Deprivation is compared between areas only**: the injury files have no deprivation, so each
  council's rate is compared with the share of its people living in the most deprived fifth of data
  zones (SIMD 2020v2 quintile 1, mid-2024 population). This is ecological: it describes areas, not
  people.

## Files

| File | Contents |
|---|---|
| `national.csv` | Scotland, each year and injury type (and all types): events, population, standardised rate, 95% interval |
| `age_falls.csv` | Falls by year and age band: events, population, age-specific rate |
| `council.csv` | Each council, pooled five years, for falls admissions, poisoning deaths and all types: rate, interval, Scotland rate, above/below/similar, quintile-1 share |
| `ecological.csv` | Spearman correlation between council rates and quintile-1 share |
| `national.*` | (a) admissions and (b) deaths by type over time; (c) falls admissions by age |
| `councils.*` | Council rates with intervals: falls admissions, poisoning deaths |
| `ecological.*` | Council rates against the share of people in the most deprived fifth |

## Findings (descriptive)

- **Admissions fell after 2019/20.** All unintentional injury admissions: 1,067 per 100,000 in
  2015/16, 1,136 in 2019/20, 961 in 2024/25 (standardised). Falls are about two thirds of them:
  660, 696 and 629 per 100,000.
- **Falls admissions are concentrated in old age**: in 2024/25, 3,573 per 100,000 people aged 75
  and over, 964 at 65-74 and 270 under 65 (age-specific). The 75-and-over rate was the same in
  2015/16 (3,566), so the number of falls admissions follows the growth of the older population.
- **Deaths: poisoning rose and fell back.** Poisoning deaths went from 12.7 per 100,000 (663
  deaths) in 2015 to 25.9 (1,373) in 2020, above falls from 2018 to 2021, then back to 19.1 (1,045)
  in 2024. Falls deaths rose steadily from 15.7 (787) to 22.0 (1,290). That poisoning deaths follow
  drug-related deaths is a plausible reading, not tested here: the file does not give the
  substance.
- **Councils differ widely.** Falls admissions, 2020/21-2024/25: from 420 per 100,000 a year
  (Highland) to 968 (Dundee City), Scotland 652; 12 councils above Scotland, 14 below. Poisoning
  deaths, 2020-2024: from 5.0 (Orkney) to 38.8 (Glasgow City), Scotland 22.2; 8 above, 14 below.
- **Poisoning deaths track area deprivation closely; falls admissions much less.** Spearman's rho
  between council rate and share of people in the most deprived fifth: 0.91 for poisoning deaths
  (0.84 for all injury deaths), 0.54 for falls admissions (0.47 for all admissions). Dundee City
  has the highest falls admission rate with a smaller deprived share than Glasgow or Inverclyde,
  and several rural councils (Argyll and Bute, Na h-Eileanan Siar, Angus, Perth and Kinross) are
  above Scotland with few people in the most deprived fifth: falls admissions vary with something
  besides deprivation (for example local admission practice), which this data cannot separate.

## Story candidates

1. Two injury stories in one dataset: falls fill hospital beds (two thirds of admissions, mostly
   people over 75), poisoning kills the young and middle-aged in deprived areas.
2. The deprivation gradient in poisoning deaths across council areas (rho 0.91).
3. Dundee and the rural councils with high falls admissions: worth asking PHS or the boards why.

## To do

- Check the national standardised rates against PHS's published unintentional injury figures.
- Age profile of poisoning deaths (the files give age), to support story 1.
- Pool deaths by age band and council for a small-multiples view.
