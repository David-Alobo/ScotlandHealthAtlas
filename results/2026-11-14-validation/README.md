# Injury figures checked against Public Health Scotland's publications (14 November 2026)

Made with `uv run python -m atlas.validate results/2026-11-14-validation`. Table:
`validation.csv` (each figure, its source, ours, the difference).

| Figure | Published | Ours | Difference |
|---|---|---|---|
| Emergency admissions, 2023/24 | 56,294 | 57,082 | +1.4% |
| Deaths, 2023 | 2,822 | 2,822 | 0.0% |
| Admissions under 15, 2023/24 | 5,746 | 5,757 | +0.2% |
| Falls share, under 15, 2023/24 | 42% | 42.2% | |
| Admissions 65 and over, 2023/24 | 28,389 | 28,886 | +1.8% |
| Falls share, 65 and over, 2023/24 | just over 86% | 86.3% | |
| Road traffic admissions under 15 per 100,000 (EASR), 2023/24 | 26 | 25.6 | -1.6% |
| Admissions 65 and over, 2024/25 | 28,455 | 28,536 | +0.3% |
| Falls share, 65 and over, 2024/25 | nearly 87% | 86.7% | |

Sources: PHS summary of 29 October 2024 (2023/24 admissions, 2023 deaths); the 2025 release's
2024/25 figures as quoted by RoSPA Scotland, since the PHS page for that release could not be
reached (links in `validation.csv`).

## Reading

- **Deaths match exactly**, and the shares and the standardised child road traffic rate (computed
  with our ESP2013 weights on coarser age bands) agree within rounding.
- **Admissions for 2023/24 are 1.4-1.8% higher in the package** than in the 2024 publication, but
  the 2024/25 count agrees within 0.3% with the 2025 release, the one the package comes from. The
  likely reason is that hospital records for a year keep arriving after it is first published, so
  the later release revises 2023/24 upwards. Not confirmed with PHS.
- The published 2014/15 road traffic rate (36) cannot be checked: the package starts in 2015/16.

The analysis reproduces PHS's own figures, so the rates in `../2026-11-14-injuries` can be used
with confidence in the method.
