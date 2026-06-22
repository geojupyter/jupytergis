"""Shared color map utilities.

Samples colours from the *same* ramp definitions the frontend uses, so the QGIS
exporter and the notebook API bake a layer's colours identically to jGIS.

``color_ramps_data.json`` is Python's internal colour lookup table (it is never
written into exported projects). It holds the upstream control points: the
continuous ramps come from the frontend's ``colormap`` package (``colorScale.js``
merged with ``cmocean.json``) and the categorical schemes from
``d3-scale-chromatic`` — the exact sources ``colorRampUtils.ts`` samples. Each
continuous ramp is a short list of ``[index, r, g, b]`` control points; colours
between them are linear in RGB, matching the ``colormap`` package's interpolation.
"""

from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path

_DATA_FILE = Path(__file__).parent / "color_ramps_data.json"
_DEFAULT_RAMP = "viridis"


@lru_cache(maxsize=1)
def _ramp_data() -> dict[str, dict[str, list]]:
    """The upstream ``{"control_points": {...}, "categorical": {...}}`` tables."""
    try:
        with _DATA_FILE.open() as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return {"control_points": {}, "categorical": {}}


def _lerp(a: float, b: float, t: float) -> int:
    # Byte-identical to the colormap package: it interpolates as `a*(1-t)+b*t` (the
    # `lerp` npm package, FP-distinct from `a+(b-a)*t`) and rounds with Math.round
    # (half up — `floor(x+0.5)` for non-negative values, vs Python's half-to-even).
    return math.floor(a * (1 - t) + b * t + 0.5)


def _colormap_exact(points: list[list[float]], n: int) -> list[tuple[int, int, int]]:
    """Replicate the ``colormap`` package's sampling exactly (byte-for-byte).

    Control-point indices (0..1) are quantised onto a 0..``n-1`` integer grid, then
    each adjacent pair is linearly interpolated across its grid steps — identical to
    ``colormap``'s ``createColormap``. Requires ``n >= len(points)`` (the package's
    own constraint); the caller uses :func:`_interp_continuous` below that.
    """
    nshades = n - 1
    grid = [round(p[0] * nshades) for p in points]
    out: list[tuple[int, int, int]] = []
    for i in range(len(points) - 1):
        steps = grid[i + 1] - grid[i]
        lo, hi = points[i], points[i + 1]
        for j in range(steps):
            t = j / steps
            out.append(
                (
                    _lerp(lo[1], hi[1], t),
                    _lerp(lo[2], hi[2], t),
                    _lerp(lo[3], hi[3], t),
                ),
            )
    last = points[-1]
    out.append((round(last[1]), round(last[2]), round(last[3])))
    return out


def _interp_continuous(
    points: list[list[float]],
    n: int,
) -> list[tuple[int, int, int]]:
    """*n* RGB tuples by continuous linear interpolation across control points.

    Used only when ``n < len(points)`` (too few shades for the quantised grid), so
    the ramp still renders correctly rather than dropping colours.
    """
    if n == 1:
        c = points[0]
        return [(round(c[1]), round(c[2]), round(c[3]))]
    out = []
    seg = 0
    for i in range(n):
        p = i / (n - 1)
        while seg < len(points) - 2 and points[seg + 1][0] < p:
            seg += 1
        lo, hi = points[seg], points[seg + 1]
        span = hi[0] - lo[0]
        t = 0.0 if span <= 0 else min(max((p - lo[0]) / span, 0.0), 1.0)
        out.append(
            (_lerp(lo[1], hi[1], t), _lerp(lo[2], hi[2], t), _lerp(lo[3], hi[3], t)),
        )
    return out


def _sample_control_points(
    points: list[list[float]],
    n: int,
) -> list[tuple[int, int, int]]:
    """*n* RGB tuples from ``[index, r, g, b]`` control points, matching the frontend.

    Byte-exact with the ``colormap`` package when ``n`` is at least the control-point
    count; continuous interpolation below that.
    """
    if n <= 0 or not points:
        return []
    if n >= len(points):
        return _colormap_exact(points, n)
    return _interp_continuous(points, n)


def sample_colors(
    name: str = "viridis",
    n: int = 9,
    *,
    reverse: bool = False,
) -> list[tuple[int, int, int, int]]:
    """Sample *n* evenly-spaced RGBA byte tuples from the named ramp.

    Each colour is ``(r, g, b, a)`` with values in ``0..255``. Continuous ramps
    (viridis, hsv, jet, the cmocean set, ...) interpolate their control points;
    categorical schemes (schemePaired, ...) cycle their discrete colours. An unknown
    name falls back to viridis.
    """
    data = _ramp_data()
    points = data["control_points"].get(name)
    if points is not None:
        if reverse:
            points = [[1.0 - p[0], p[1], p[2], p[3]] for p in reversed(points)]
        return [(r, g, b, 255) for r, g, b in _sample_control_points(points, n)]

    categories = data["categorical"].get(name)
    if categories:
        cols = list(reversed(categories)) if reverse else categories
        return [(*cols[i % len(cols)], 255) for i in range(n)]

    fallback = data["control_points"].get(_DEFAULT_RAMP)
    if fallback is None:
        return [(0, 0, 0, 255) for _ in range(n)]
    return [(r, g, b, 255) for r, g, b in _sample_control_points(fallback, n)]
