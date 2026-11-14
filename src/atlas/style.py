"""One publication style for every figure of the atlas.

Figures are sized for a journal column (single 85 mm, double 175 mm), use fonts readable at that
size, label their axes with units, carry their data source, and are saved as vector PDF and SVG
plus a 300-dpi PNG. Colours come from a validated, colour-blind-safe palette (checked with the
dataviz skill's validator, 14 November 2026):

- CATEGORICAL: categories in a fixed order, never cycled; two of the first four colours are
  below 3:1 contrast on white, so charts using them always have direct labels or a legend;
- QUINTILE: one blue ramp, light to dark, for SIMD quintiles (an ordered scale): darkest is the
  most deprived. Validated as an ordinal ramp (monotone lightness, light end 2.06:1 on white).
"""

from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from matplotlib.ticker import FuncFormatter  # noqa: E402
from matplotlib.transforms import Bbox  # noqa: E402

MM = 1 / 25.4  # inches per millimetre
SINGLE = 85 * MM
DOUBLE = 175 * MM

INK = "#0b0b0b"
INK_2 = "#52514e"
INK_3 = "#7a7974"
GRID = "#e6e5e1"
SURFACE = "#ffffff"

CATEGORICAL = [
    "#2a78d6",
    "#eb6834",
    "#1baf7a",
    "#eda100",
    "#e87ba4",
    "#008300",
    "#6250d6",
    "#e34948",
]
QUINTILE = {1: "#0d366b", 2: "#184f95", 3: "#256abf", 4: "#3987e5", 5: "#86b6ef"}
QUINTILE_NAME = {1: "1 most deprived", 2: "2", 3: "3", 4: "4", 5: "5 least deprived"}

SOURCE_PHS = "Data: Public Health Scotland (Data Lab competition package, 2026)"


def use() -> None:
    """Apply the publication style to matplotlib."""
    plt.rcParams.update(
        {
            "font.family": "sans-serif",
            "font.sans-serif": ["Arial", "Helvetica", "DejaVu Sans"],
            "font.size": 8,
            "axes.titlesize": 9,
            "axes.titleweight": "bold",
            "axes.titlelocation": "left",
            "axes.titlecolor": INK,
            "axes.labelsize": 8,
            "axes.labelcolor": INK_2,
            "axes.edgecolor": INK_3,
            "axes.linewidth": 0.6,
            "axes.spines.top": False,
            "axes.spines.right": False,
            "axes.grid": False,  # no gridlines: axes and direct labels carry the values
            "axes.axisbelow": True,
            "axes.facecolor": SURFACE,
            "grid.color": GRID,
            "grid.linewidth": 0.6,
            "xtick.color": INK_3,
            "ytick.color": INK_3,
            "xtick.labelcolor": INK_2,
            "ytick.labelcolor": INK_2,
            "xtick.labelsize": 7,
            "ytick.labelsize": 7,
            "xtick.major.width": 0.6,
            "ytick.major.width": 0.6,
            "xtick.major.size": 2.5,
            "ytick.major.size": 0,
            "lines.linewidth": 1.4,
            "lines.markersize": 3.5,
            "legend.fontsize": 7,
            "legend.frameon": False,
            "figure.facecolor": SURFACE,
            "figure.dpi": 150,
            "savefig.dpi": 300,
            "savefig.bbox": "tight",
            "savefig.pad_inches": 0.04,
            "pdf.fonttype": 42,  # embed TrueType, so text stays editable
            "svg.fonttype": "none",
        }
    )


def thousands(scale: float = 1.0, suffix: str = ""):
    """A tick formatter with thousands separators, optionally scaled.

    Args:
        scale: Divide values by this before printing (1000 shows thousands).
        suffix: Text after each number.

    Returns:
        A matplotlib formatter.
    """
    return FuncFormatter(lambda v, _p: f"{v / scale:,.0f}{suffix}")


def plain_log(ax, axis: str = "x") -> None:
    """Label a log axis with plain numbers (1, 10, 100, 1,000) rather than powers of ten.

    Args:
        ax: The axes.
        axis: "x" or "y".
    """
    target = ax.xaxis if axis == "x" else ax.yaxis
    target.set_major_formatter(FuncFormatter(lambda v, _p: f"{v:,.0f}"))
    target.set_minor_formatter(FuncFormatter(lambda v, _p: ""))


def titles(fig, ax, title: str, subtitle: str | None = None) -> None:
    """A figure title and optional subtitle above the axes, aligned with its left edge.

    Args:
        fig: The figure.
        ax: The main axes (the text aligns with its left edge).
        title: The title.
        subtitle: A smaller line under it, or None.
    """
    ax.set_title(subtitle or "", fontsize=6.5, fontweight="normal", color=INK_2, pad=4)
    ax.text(
        0,
        1.0,
        title,
        transform=ax.transAxes,
        fontsize=9,
        fontweight="bold",
        color=INK,
        va="bottom",
        ha="left",
    ).set_y(1.07 if subtitle else 1.02)


def label_ends(ax, ends: list[tuple[str, float, float]], gap_pt: float = 9.0) -> None:
    """Label lines at their right ends, nudging labels apart so none overlap.

    Args:
        ax: The axes (draw the lines and set the y limits first).
        ends: (label, last x, last y) for each line.
        gap_pt: The least vertical distance between label centres, in points.
    """
    from matplotlib.transforms import offset_copy

    fig = ax.figure
    fig.canvas.draw()
    to_px, from_px = ax.transData.transform, ax.transData.inverted().transform
    gap_px = gap_pt * fig.dpi / 72
    ends = [(text, ax.convert_xunits(x), y) for text, x, y in ends]  # dates to plot numbers
    placed = sorted((to_px((x, y))[1], text, x) for text, x, y in ends)
    heights = [p[0] for p in placed]
    for i in range(1, len(heights)):  # push labels up where they would touch the one below
        heights[i] = max(heights[i], heights[i - 1] + gap_px)
    shift = offset_copy(ax.transData, fig=fig, x=5, y=0, units="points")  # gap after the line
    for (_y, text, x), h in zip(placed, heights, strict=True):
        ax.text(
            x,
            from_px((0, h))[1],
            text,
            transform=shift,
            va="center",
            ha="left",
            fontsize=7,
            color=INK_2,
            clip_on=False,
        )


def label_points(
    ax,
    labels: list[tuple[str, float, float]],
    avoid: list[tuple[float, float]] = (),
    fontsize: float = 6,
    marker_pt: float = 3.0,
) -> list:
    """Label scatter points, each in the first nearby spot that overlaps no other label or point.

    Spots are tried in order: right of the point, above, below (centred, then starting at the
    point), left. A spot is free when the
    label overlaps no point, no label placed before it and no text already on the axes (add notes
    first), and stays right of the y axis and below the top of the plot. A label that fits nowhere
    keeps the first spot.

    Args:
        ax: The axes (draw the points and set the limits first).
        labels: (label, x, y) for each point to label.
        avoid: Every plotted point (x, y), labelled or not, that labels must not cover.
        fontsize: Label size in points.
        marker_pt: Half the marker's size, in points, kept clear around each point.

    Returns:
        The text artists, in the order given.
    """
    fig = ax.figure
    fig.canvas.draw()
    renderer = fig.canvas.get_renderer()
    px = fig.dpi / 72
    to_px = ax.transData.transform
    r = marker_pt * px
    dots = [Bbox.from_extents(*(to_px(p) - r), *(to_px(p) + r)) for p in avoid]
    spots = [
        ((4, 0), "left", "center"),
        ((0, 5), "center", "bottom"),
        ((0, -5), "center", "top"),
        ((-3, 5), "left", "bottom"),  # starting at the point: for points against the y axis
        ((-3, -5), "left", "top"),
        ((-4, 0), "right", "center"),
    ]

    def put(text, x, y, spot):
        offset, ha, va = spot
        t = ax.annotate(
            text,
            (x, y),
            xytext=offset,
            textcoords="offset points",
            ha=ha,
            va=va,
            fontsize=fontsize,
            color=INK_2,
            annotation_clip=False,
        )
        return t, t.get_window_extent(renderer)

    frame = ax.get_window_extent(renderer)
    # text already on the axes (a note, a correlation) is an obstacle too
    placed: list[Bbox] = [t.get_window_extent(renderer) for t in ax.texts]
    texts = []
    for text, x, y in labels:
        own = Bbox.from_extents(*(to_px((x, y)) - r), *(to_px((x, y)) + r))
        others = [d for d in dots if not np.allclose(d.extents, own.extents)]
        for spot in spots:
            t, box = put(text, x, y, spot)
            # stay right of the y axis and below the top of the plot (the title lives there)
            inside = box.x0 >= frame.x0 and box.y1 <= frame.y1
            if inside and not any(box.overlaps(b) for b in placed + others):
                break
            t.remove()
        else:  # nowhere free: fall back to the first spot
            t, box = put(text, x, y, spots[0])
        texts.append(t)
        placed.append(box)
    return texts


def source(fig, text: str, gap_pt: float = 6.0) -> None:
    """The data source, small and muted, under the figure, wrapped to the figure's width.

    Placed just below the lowest thing drawn on any axes (tick labels, axis titles), so it never
    collides with them and leaves no empty band, whatever the layout. Call it after the axes are
    finished.

    Args:
        fig: The figure.
        text: The source line(s).
        gap_pt: Space between the lowest axes element and the source, in points.
    """
    import textwrap

    fig.canvas.draw()
    renderer = fig.canvas.get_renderer()
    lowest_px = min(ax.get_tightbbox(renderer).y0 for ax in fig.axes)
    y = (lowest_px - gap_pt * fig.dpi / 72) / fig.bbox.height
    width = int(fig.get_figwidth() / MM * 0.62)  # about how many 6-pt characters fit
    fig.text(
        0.0,
        y,
        textwrap.fill(text, width),
        fontsize=6,
        color=INK_3,
        va="top",
        ha="left",
        transform=fig.transFigure,
        linespacing=1.3,
    )


def panel(ax, letter: str) -> None:
    """A bold panel letter (a, b, c) at the top left of a panel.

    Args:
        ax: The panel.
        letter: Its letter.
    """
    ax.text(
        -0.02,
        1.06,
        letter,
        transform=ax.transAxes,
        fontsize=9,
        fontweight="bold",
        color=INK,
        ha="right",
        va="bottom",
    )


def save(fig, stem: Path) -> list[Path]:
    """Save a figure as PDF, SVG and 300-dpi PNG.

    Args:
        fig: The figure.
        stem: The path without extension.

    Returns:
        The three files written.
    """
    stem.parent.mkdir(parents=True, exist_ok=True)
    paths = [stem.with_suffix(s) for s in (".pdf", ".svg", ".png")]
    for p in paths:
        fig.savefig(p)
    plt.close(fig)
    return paths
