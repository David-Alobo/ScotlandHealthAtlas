"""Build the maps for the web story: deprivation by neighbourhood and council areas.

Usage (from the repository root): uv run python -m atlas.geo [output file]

Input: the Scottish Government's 2011 data zone boundaries (data/external/dz2011, Open Government
Licence; British National Grid). Each of the 6,976 data zones is joined to its SIMD 2020v2 quintile
and council area (data zone look-up). mapshaper (web/node_modules) merges the zones into the 32
council areas, simplified for the web, and gives each zone a point inside it. Neighbourhoods are
drawn as points, not shapes: at the scale of Scotland, urban zones (where most deprived ones are)
are too small to see as shapes, and each holds roughly the same number of people (about 800), so
one dot per zone shows where people live. The national grid is a flat projection in metres, so
coordinates are scaled linearly into SVG units (north up).
Writes web/data/geo.json: viewBox size, council paths with a centre point, and the zone dots.
"""

from __future__ import annotations

import csv
import json
import subprocess
import sys
from pathlib import Path

import openpyxl

from .population import LOOKUP

SHAPES = Path("data/external/dz2011/SG_DataZone_Bdry_2011.shp")
DERIVED = Path("data/derived")
MAPSHAPER = Path("web/node_modules/mapshaper/bin/mapshaper")
WIDTH = 600.0  # SVG units across Scotland's bounding box
SIMPLIFY = "0.6%"  # share of vertices kept (Visvalingam, topology kept between neighbours)
MIN_RING = 0.6  # rings smaller than this many square SVG units (tiny islets) are dropped


FIELDS = {  # look-up column -> our name
    "DZ": "DataZone",
    "DZname": "name",
    "SIMD2020v2_Rank": "rank",
    "SIMD2020v2_Quintile": "quintile",
    "Population": "population",
    "LAname": "council",
}


def write_lookup(path: Path) -> None:
    """The SIMD 2020v2 data zone look-up as CSV for mapshaper and the web export.

    Columns: zone code, name, SIMD rank (1 = most deprived), quintile, population, council.

    Args:
        path: Where to write.
    """
    ws = openpyxl.load_workbook(LOOKUP, read_only=True)["SIMD 2020v2 DZ lookup data"]
    rows = ws.iter_rows(values_only=True)
    head = list(next(rows))
    idx = [head.index(c) for c in FIELDS]
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(FIELDS.values())
        for r in rows:
            if r[0]:
                w.writerow([r[i] for i in idx])


def dissolve(field: str | None, out: Path, table: Path) -> dict:
    """Merge data zones by a field (or into one outline) and simplify, with mapshaper.

    Args:
        field: The field to merge by, or None for Scotland's outline.
        out: GeoJSON file to write.
        table: The look-up CSV.

    Returns:
        The GeoJSON.
    """
    cmd = [
        "node", str(MAPSHAPER), str(SHAPES),
        "-join", str(table), "keys=DataZone,DataZone", "string-fields=DataZone,council,name",
        "-dissolve2", *([field] if field else []),
        "-simplify", SIMPLIFY, "keep-shapes", "planar",
        "-o", str(out), "format=geojson", "precision=1", "force",
    ]  # fmt: skip
    subprocess.run(cmd, check=True, capture_output=True)
    data = json.loads(out.read_text(encoding="utf-8"))
    if "features" not in data:  # dissolving everything gives a bare GeometryCollection
        data = {"features": [{"geometry": g, "properties": {}} for g in data["geometries"]]}
    return data


def zone_points(out: Path, table: Path) -> list[dict]:
    """A point inside each data zone, with its look-up fields, from mapshaper.

    Args:
        out: GeoJSON file to write.
        table: The look-up CSV.

    Returns:
        For each zone: x, y (easting, northing), name, rank, quintile, population, council.
    """
    cmd = [
        "node", str(MAPSHAPER), str(SHAPES),
        "-join", str(table), "keys=DataZone,DataZone", "string-fields=DataZone,council,name",
        "-points", "inner",
        "-o", str(out), "format=geojson", "precision=1", "force",
    ]  # fmt: skip
    subprocess.run(cmd, check=True, capture_output=True)
    feats = json.loads(out.read_text(encoding="utf-8"))["features"]
    return [
        {
            "x": f["geometry"]["coordinates"][0],
            "y": f["geometry"]["coordinates"][1],
            "name": f["properties"]["name"],
            "rank": int(f["properties"]["rank"]),
            "quintile": int(f["properties"]["quintile"]),
            "population": int(f["properties"]["population"]),
            "council": f["properties"]["council"],
        }
        for f in feats
        if f["geometry"]
    ]


def rings(geometry: dict) -> list[list[list[float]]]:
    """Every ring of a Polygon or MultiPolygon.

    Args:
        geometry: A GeoJSON geometry.

    Returns:
        The rings, each a list of [x, y].
    """
    if geometry["type"] == "Polygon":
        return geometry["coordinates"]
    return [r for poly in geometry["coordinates"] for r in poly]


def area(ring: list[list[float]]) -> float:
    """The signed area of a ring (shoelace formula).

    Args:
        ring: Points [x, y].

    Returns:
        The area, positive or negative by winding.
    """
    return 0.5 * sum(
        x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1], strict=True)
    )


def centroid(ring: list[list[float]]) -> tuple[float, float]:
    """The centroid of a ring.

    Args:
        ring: Points [x, y].

    Returns:
        (x, y).
    """
    a = area(ring)
    if a == 0:
        return ring[0][0], ring[0][1]
    cx = cy = 0.0
    for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1], strict=True):
        k = x0 * y1 - x1 * y0
        cx += (x0 + x1) * k
        cy += (y0 + y1) * k
    return cx / (6 * a), cy / (6 * a)


class Frame:
    """Maps national grid metres to SVG units: Scotland's box, WIDTH across, north up."""

    def __init__(self, bbox: tuple[float, float, float, float]):
        """Set the frame.

        Args:
            bbox: (xmin, ymin, xmax, ymax) in metres.
        """
        self.x0, self.y0, x1, self.y1 = bbox
        self.k = WIDTH / (x1 - self.x0)
        self.height = round((self.y1 - self.y0) * self.k, 1)

    def point(self, x: float, y: float) -> tuple[float, float]:
        """A grid point in SVG units.

        Args:
            x: Easting.
            y: Northing.

        Returns:
            (x, y) in SVG units.
        """
        return round((x - self.x0) * self.k, 1), round((self.y1 - y) * self.k, 1)

    def path(self, geometry: dict) -> str:
        """An SVG path for a geometry, leaving out rings too small to see.

        Args:
            geometry: A GeoJSON geometry in metres.

        Returns:
            The path data.
        """
        parts = []
        for ring in rings(geometry):
            pts = [self.point(x, y) for x, y in ring]
            if abs(area([list(p) for p in pts])) < MIN_RING:
                continue
            parts.append("M" + "L".join(f"{x:g},{y:g}" for x, y in pts) + "Z")
        return "".join(parts)


def bbox(features: list[dict]) -> tuple[float, float, float, float]:
    """The bounding box of features.

    Args:
        features: GeoJSON features.

    Returns:
        (xmin, ymin, xmax, ymax).
    """
    xs, ys = [], []
    for f in features:
        for ring in rings(f["geometry"]):
            xs += [p[0] for p in ring]
            ys += [p[1] for p in ring]
    return min(xs), min(ys), max(xs), max(ys)


def main() -> None:
    """Build web/data/geo.json."""
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("web/data/geo.json")
    table = DERIVED / "dz_lookup.csv"
    write_lookup(table)
    councils = dissolve("council", DERIVED / "geo_councils.json", table)["features"]
    points = zone_points(DERIVED / "geo_zones.json", table)
    frame = Frame(bbox(councils))

    council_rows = []
    for f in sorted(councils, key=lambda f: f["properties"]["council"]):
        largest = max(rings(f["geometry"]), key=lambda r: abs(area(r)))
        cx, cy = frame.point(*centroid(largest))
        council_rows.append(
            {"council": f["properties"]["council"], "path": frame.path(f["geometry"]),
             "cx": cx, "cy": cy}
        )  # fmt: skip
    index = {c["council"]: i for i, c in enumerate(council_rows)}
    geo = {
        "width": WIDTH,
        "height": frame.height,
        "councils": council_rows,
        # one dot per data zone: [x, y, SIMD quintile, SIMD rank (1 = most deprived), population,
        # council index]; names in the same order in zone_names
        "zones": [
            [
                *frame.point(p["x"], p["y"]),
                p["quintile"],
                p["rank"],
                p["population"],
                index[p["council"]],
            ]
            for p in points
        ],  # fmt: skip
        "zone_names": [p["name"] for p in points],
        "source": "Data zone boundaries 2011, Scottish Government (Open Government Licence); "
        "SIMD 2020v2.",
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(geo, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"wrote {out}: {out.stat().st_size / 1e3:.0f} kB, {len(council_rows)} councils")


if __name__ == "__main__":
    main()
