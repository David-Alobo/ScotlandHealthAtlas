# Scotland Health Atlas

Telling Scotland's health story with open data: how emergency care, unintentional injuries and
community prescribing differ across Scotland's places and communities, and how that has changed.

A [Monstrous Data](https://monstrous.com.ng) project by David Obeh Alobo. It began as an entry to
The Data Lab Community's [data visualisation competition](https://thedatalab.com/data-visualisation-competition/)
(theme: *Telling Scotland's health story*, with data from Public Health Scotland) and is being
built further as an open, reproducible atlas.

## What is here

| Folder | What it holds |
|---|---|
| `data/` | Where the data comes from (`data/README.md`); the files themselves are not in git |
| `src/atlas/` | The data pipeline (Python): reading, checking and summarising the data |
| `results/` | Tables and notes from each analysis, dated, with the scripts that made them |
| `web/` | The visual story (vanilla JavaScript) |
| `paper/` | A paper, if the analysis supports one |
| `docs/` | Plans and notes |

## Status

Started 14 November 2026. Data downloaded and audited ([results/2026-11-14-data-audit](results/2026-11-14-data-audit/README.md)); population denominators added; first analysis: [A&E rates by deprivation](results/2026-11-14-ae-deprivation/README.md); [distributions of every dataset](results/2026-11-14-distributions/README.md). Figures follow one publication style (src/atlas/style.py). Next: injuries and prescribing first looks, then a story shortlist.

## Data

Public Health Scotland, via the Scottish Health and Social Care Open Data platform, as packaged for
the competition ("Telling Scotland's Health Story", K. Nicholson, Public Health Scotland, 2026).
Other open data added later is listed, with its source and licence, in `data/README.md`.
