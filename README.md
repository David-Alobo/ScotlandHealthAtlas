# Scotland Health Atlas

An open atlas of health in Scotland: A&E attendances, unintentional injuries and community
prescribing, turned into rates by age, sex, place and deprivation, and followed over time. Built
from Public Health Scotland and National Records of Scotland open data, with every figure
traceable to saved tables and the scripts that made them.

A [Monstrous Data](https://monstrous.com.ng) project by David Obeh Alobo. It began as an entry to
The Data Lab Community's 2026 [data visualisation competition](https://thedatalab.com/data-visualisation-competition/)
(theme: *Telling Scotland's health story*) and is being built further as an open, reproducible
atlas.

## What is here

| Folder | What it holds |
|---|---|
| `data/` | Where the data comes from (`data/README.md`); the files themselves are not in git |
| `src/atlas/` | The data pipeline (Python package `atlas`): one module per analysis, plus `stats.py` (rates, intervals, correlation) and `style.py` (figure style) |
| `tests/` | Unit tests (pytest); they need no data, so they run in CI |
| `results/` | Tables and notes from each analysis, dated, with the scripts that made them |
| `web/` | The visual story (vanilla JavaScript) |
| `paper/` | A paper, if the analysis supports one |
| `docs/` | Plans and notes |

## Running it

Needs [uv](https://docs.astral.sh/uv/) and Python 3.12. Dependencies are pinned in
`pyproject.toml` and `uv.lock` to the versions the saved results were made with.

```bash
uv sync                      # create .venv with the locked dependencies
uv run pytest                # unit tests
uv run ruff check . && uv run ruff format --check .   # lint and format (also run in CI)
```

The analyses need the data in `data/raw/` and `data/external/` (see `data/README.md`). Run them
from the repository root, in this order:

```bash
uv run python -m atlas.audit results/2026-11-14-data-audit
uv run python -m atlas.population            # writes data/derived/
uv run python -m atlas.ae_deprivation
uv run python -m atlas.distributions results/2026-11-14-distributions
uv run python -m atlas.injuries results/2026-11-14-injuries
uv run python -m atlas.prescribing results/2026-11-14-prescribing
```

## Status

Started 14 November 2026. Done:
- data downloaded and audited ([data audit](results/2026-11-14-data-audit/README.md));
- population denominators (NRS small area estimates, SIMD 2020v2);
- [A&E rates by deprivation](results/2026-11-14-ae-deprivation/README.md);
- [distributions of every dataset](results/2026-11-14-distributions/README.md);
- [injury rates by council and deprivation](results/2026-11-14-injuries/README.md);
- [prescribing by deprivation of where it is dispensed](results/2026-11-14-prescribing/README.md).

- [story shortlist](docs/STORIES.md) for the competition entry.

Next: check injury rates against PHS published figures, then screen versions of the chosen charts.

## Data

Public Health Scotland, via the Scottish Health and Social Care Open Data platform, as packaged for
the competition ("Telling Scotland's Health Story", K. Nicholson, Public Health Scotland, 2026).
Other open data added later is listed, with its source and licence, in `data/README.md`.
