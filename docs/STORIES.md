# Story shortlist (14 November 2026)

For the Data Lab competition entry ("Telling Scotland's health story"; submissions 25 November
2026 to 15 January 2027; judged on clarity, creativity and design, and data analysis and
accuracy). Every number below comes from a saved table in `results/`; the figures named are the
first drafts, drawn for print, and will be redesigned for screen.

## Recommendation

One narrative across all three datasets, built from candidates 1, 2 and 3:

> **Same country, different risks.** Where you live shapes how often you end up in A&E and how
> likely you are to die of poisoning; how old you are shapes your risk of a fall. Two different
> problems, two different groups of people, in one health service.

It uses every dataset in the package, each claim survived its checks, and the contrast (deprivation
against age; poisoning against falls) gives the piece a shape a reader can follow. Prescribing (4)
supports it with one panel; 5 is held back.

## Candidates

### 1. Falls and poisoning kill different people (strongest)

- **Claim**: unintentional injury deaths split into two groups. Falls: 1,111 deaths a year
  (2020-2024), 87% aged 75 and over, 57% women. Poisoning: 1,197 a year, 90% aged 25-64, 70% men.
  Falls are also two thirds of injury admissions (half of them people aged 75 and over).
- **Evidence**: `results/2026-11-14-injuries/age_profile.csv`, `national.csv`.
- **First chart**: `results/2026-11-14-injuries/age_profile.png` (deaths and admissions a year by
  age, falls against poisoning); `national.png` (poisoning deaths rising to 2020, falls rising
  steadily).
- **Caveats**: the file does not give the substance in poisoning deaths; linking them to
  drug-related deaths is a reading, not a finding. Counts, not rates, in the age chart (rates are
  in the table).

### 2. Twice as often: A&E and deprivation

- **Claim**: people in the most deprived fifth of neighbourhoods attend A&E about twice as often as
  people in the least deprived fifth, of the same age and sex, in every year from 2018 to 2025
  (2025: 380 against 200 per 1,000); a steady step at each quintile.
- **Evidence**: `results/2026-11-14-ae-deprivation/rates.csv`, `gap.csv`,
  `gap_sensitivity.csv`.
- **First chart**: `results/2026-11-14-ae-deprivation/rates.png`.
- **Caveats**: no claim that the gap is narrowing (the drift from 2.03 to 1.90 is within what the
  rising unknown-deprivation share can produce). Attendances are visits, not people.

### 3. Poisoning deaths follow deprivation across Scotland

- **Claim**: council poisoning death rates (2020-2024, age-sex standardised) run from 5.0 per
  100,000 (Orkney) to 38.8 (Glasgow City) and rise with the share of people in the most deprived
  fifth (Spearman rho 0.91, 32 councils); falls admissions much less so (0.53).
- **Evidence**: `results/2026-11-14-injuries/council.csv`, `ecological.csv`.
- **First charts**: `councils.png` (rates with 95% intervals), `ecological.png`.
- **Caveats**: areas compared, not people (ecological). Small councils have wide intervals.

### 4. What is dispensed differs with deprivation (supporting)

- **Claim**: nervous-system medicines are 21.2% of items dispensed in the most deprived fifth of
  data zones against 16.8% in the least; respiratory 7.8% against 6.6%.
- **Evidence**: `results/2026-11-14-prescribing/chapters.csv`.
- **First chart**: `results/2026-11-14-prescribing/quintiles.png`, panel c.
- **Caveats**: counted where dispensed, not where patients live; not age-adjusted (the files have
  no age); chapters are broad. Items per person by quintile mostly reflect where pharmacies are,
  so that panel stays out of the story.

### 5. Falls admissions vary by place more than deprivation explains (held back)

- **Claim**: Dundee City admits 968 per 100,000 a year after a fall against 652 for Scotland;
  several rural councils are also above Scotland with few deprived residents.
- **Why held back**: the likely reasons (admission practice, coding, frailty services) are not in
  the data; it raises a question rather than telling a story. Kept for the atlas.

## Shape of the entry (draft)

A single scrolling page (vanilla JavaScript, `web/`), five scenes:

1. Opening: one number each for A&E, injuries and prescribing in a year.
2. Twice as often (candidate 2): the five quintile lines.
3. Two kinds of injury death (candidate 1): the age profile, with falls and poisoning
   highlighted in turn.
4. Where poisoning deaths happen (candidate 3): councils, ranked, coloured by deprivation; a map
   if a council boundary file under an open licence is added.
5. Close: what the data can and cannot say (the caveats above, briefly), and the method and code.

## Before building

- Check national injury rates against PHS's published figures (to do in the injuries README).
- Decide the submission format once the competition's entry form opens (25 November); the
  webinar on 18 November may say what judges expect.
- Screen versions of the figures: larger type, one message each, direct labels.
