"""Tests for atlas.paper_numbers: the macros the paper quotes are well formed."""

import re

from atlas.paper_numbers import macros, num, pct, table_councils, table_validation


def test_formatting_helpers():
    assert pct(0.371) == "37"
    assert pct(0.0055, 2) == "0.55"
    assert num(1652428) == "1{,}652{,}428"


def test_macro_names_and_values():
    m = macros()
    for name, value in m.items():
        assert re.fullmatch(r"[A-Za-z]+", name), name  # LaTeX command names take letters only
        assert value, name
        assert "%" not in value and "&" not in value, name


def test_tables_have_complete_rows():
    for rows in (table_councils(), table_validation()):
        lines = rows.strip().splitlines()
        assert lines
        width = {line.count("&") for line in lines}
        assert len(width) == 1  # every row has the same number of columns
        assert all(line.endswith(r"\\") for line in lines)
