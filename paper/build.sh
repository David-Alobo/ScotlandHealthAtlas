#!/usr/bin/env bash
# Build the paper (diagrams first). Usage (in WSL): bash paper/build.sh
# Regenerate the numbers first on Windows or Linux: uv run python -m atlas.paper_numbers
set -euo pipefail
cd "$(dirname "$0")"
bash figures/build.sh
latexmk -pdf -interaction=nonstopmode -halt-on-error main.tex > /dev/null || {
  grep -m10 -A4 '^!' main.log; exit 1; }
grep -E "undefined|Overfull" main.log || echo "no undefined references or overfull boxes"
latexmk -c > /dev/null
echo "wrote paper/main.pdf"
