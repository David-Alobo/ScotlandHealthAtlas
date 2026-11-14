import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

from atlas import style  # noqa: E402
from atlas.distributions import label_of  # noqa: E402
from atlas.prescribing import postcode_key  # noqa: E402


def test_postcode_key_ignores_case_and_spacing():
    assert postcode_key("g22 5er") == "G225ER"
    assert postcode_key(" G22  5ER ") == "G225ER"
    assert postcode_key("AB101AL") == "AB101AL"


def test_label_of_shortens_and_recases():
    assert label_of("NHS Greater Glasgow and Clyde") == "Greater Glasgow and Clyde"
    assert label_of("CENTRAL NERVOUS SYSTEM") == "Central nervous system"


def test_label_points_avoids_labels_and_points():
    style.use()
    fig, ax = plt.subplots(figsize=(3, 2))
    pts = [(0.0, 10.0), (1.0, 10.0), (2.0, 10.0), (5.0, 2.0)]  # three in a tight row
    ax.scatter(*zip(*pts, strict=True))
    ax.set_xlim(-1, 10)
    ax.set_ylim(0, 12)
    texts = style.label_points(
        ax, [("first label", 0.0, 10.0), ("second label", 1.0, 10.0)], avoid=pts
    )
    fig.canvas.draw()
    renderer = fig.canvas.get_renderer()
    boxes = [t.get_window_extent(renderer) for t in texts]
    assert not boxes[0].overlaps(boxes[1])
    third = ax.transData.transform((2.0, 10.0))
    for b in boxes:  # neither label sits on the unlabelled neighbour
        assert not b.contains(*third)
    plt.close(fig)


def test_source_sits_below_axes_without_overlap():
    style.use()
    fig, ax = plt.subplots(figsize=(3, 2))
    ax.plot([0, 1], [0, 1])
    ax.set_xlabel("a two-line\naxis title")
    style.source(fig, "Data: somewhere")
    fig.canvas.draw()
    renderer = fig.canvas.get_renderer()
    src = fig.texts[-1].get_window_extent(renderer)
    assert src.y1 <= ax.get_tightbbox(renderer).y0
    plt.close(fig)


def test_label_ends_keeps_labels_apart():
    style.use()
    fig, ax = plt.subplots(figsize=(3, 2))
    for y in (10.0, 10.1, 10.2):  # three lines ending almost together
        ax.plot([0, 1], [0, y])
    ax.set_ylim(0, 12)
    before = len(ax.texts)
    style.label_ends(ax, [("a", 1, 10.0), ("b", 1, 10.1), ("c", 1, 10.2)], gap_pt=9.0)
    labels = ax.texts[before:]
    fig.canvas.draw()
    ys = sorted(t.get_window_extent().y0 for t in labels)
    gap_px = 9.0 * fig.dpi / 72
    assert all(b - a >= gap_px - 0.5 for a, b in zip(ys, ys[1:], strict=False))
    plt.close(fig)
