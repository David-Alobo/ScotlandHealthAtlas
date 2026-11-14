#!/usr/bin/env bash
# Build the conceptual diagrams (TikZ, standalone) to PDF for the paper and PNG for the README.
# Usage (in WSL, from paper/figures): bash build.sh
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p ../../docs/figures
for f in design concept; do
  latexmk -pdf -interaction=nonstopmode -halt-on-error "$f.tex" > /dev/null || {
    grep -m5 -A3 '^!' "$f.log"; exit 1; }
  pdftoppm -png -r 220 -singlefile "$f.pdf" "../../docs/figures/$f"
  echo "$f ok"
done
latexmk -c > /dev/null
