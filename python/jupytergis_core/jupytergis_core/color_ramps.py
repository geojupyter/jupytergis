"""Shared color ramp utilities using branca.

Maps the frontend colorRamp names (from colorRampUtils.ts) to branca
LinearColormaps so that both the QGIS exporter and the notebook API can
sample colors from the same ramps.
"""

from __future__ import annotations

from branca.colormap import LinearColormap, linear

# Frontend name → branca attribute mapping
_FRONTEND_TO_BRANCA: dict[str, str] = {
    # matplotlib perceptual ramps (exact match in branca)
    "viridis": "viridis",
    "inferno": "inferno",
    "magma": "magma",
    "plasma": "plasma",
    # ColorBrewer – note the frontend uses slightly different casing/spelling
    "greys": "Greys_09",
    "greens": "Greens_09",
    "YiGnBu": "YlGnBu_09",
    "YiOrRd": "YlOrRd_09",
    "RdBu": "RdBu_09",
    # d3 categorical → closest ColorBrewer equivalent
    "schemeAccent": "Accent_08",
    "schemeDark2": "Dark2_08",
    "schemePaired": "Paired_12",
    "schemePastel1": "Pastel1_09",
    "schemePastel2": "Pastel2_08",
    "schemeSet1": "Set1_09",
    "schemeSet2": "Set2_08",
    "schemeSet3": "Set3_12",
}

_DEFAULT_RAMP = "viridis"


def _resolve(name: str) -> LinearColormap:
    """Resolve a frontend ramp name to a branca LinearColormap."""
    branca_name = _FRONTEND_TO_BRANCA.get(name, name)
    cm = getattr(linear, branca_name, None)
    if cm is not None:
        return cm
    # Fall back to viridis
    return getattr(linear, _DEFAULT_RAMP)


def get_color_ramp(
    name: str = "viridis",
    *,
    reverse: bool = False,
    vmin: float = 0.0,
    vmax: float = 1.0,
) -> LinearColormap:
    """Return a branca ``LinearColormap`` for the given frontend ramp name.

    Parameters
    ----------
    name : str
        A color ramp name as used by the frontend (e.g. ``"viridis"``,
        ``"YiGnBu"``, ``"schemeSet1"``).
    reverse : bool
        If ``True``, reverse the color order.
    vmin, vmax : float
        The value range the colormap should cover.

    """
    cm = _resolve(name).scale(vmin, vmax)
    if reverse:
        # Reverse by swapping the color list
        cm = LinearColormap(
            colors=list(reversed(cm.colors)),
            vmin=vmin,
            vmax=vmax,
        )
    return cm


def sample_colors(
    name: str = "viridis",
    n: int = 9,
    *,
    reverse: bool = False,
) -> list[tuple[int, int, int, int]]:
    """Sample *n* evenly-spaced RGBA byte tuples from the named ramp.

    Each color is ``(r, g, b, a)`` with values in ``0..255``.
    """
    cm = get_color_ramp(name, reverse=reverse, vmin=0.0, vmax=1.0)
    return [cm.rgba_bytes_tuple(i / max(n - 1, 1)) for i in range(n)]
