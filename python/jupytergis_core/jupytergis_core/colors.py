"""Shared color parsing utilities.

Used by both ``jupytergis_qgis`` (QGIS import/export) and ``jupytergis_lab``
(notebook GIS API) so hex ↔ rgba conversions are defined in exactly one place.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Sequence

import webcolors

RGBA = tuple[float, float, float, float]




def rgb_to_hex(rgb_str: str) -> str:
    """Convert a comma-separated ``"r,g,b"`` (or ``"r,g,b,a"``) string to a
    ``#rrggbb`` hex code. Any channel past the first three is ignored.
    """
    parts = rgb_str.split(",")[:3]
    r, g, b = (int(val) for val in parts)
    return f"#{r:02x}{g:02x}{b:02x}"


def coerce_rgba(value: RGBA | Sequence[float] | str) -> list[float]:
    """Try to parse a color ('#ffffff', 'white', [255, 255, 255]) into RGBA list."""
    if isinstance(value, str):
        color = None

        try:
            hex_color = webcolors.normalize_hex(value)
            color = webcolors.hex_to_rgb(hex_color)
        except ValueError as err:
            if value not in webcolors.names("css3"):
                raise ValueError(f'Invalid color "{value}"') from err

            color = webcolors.html5_parse_legacy_color(value)

        return [*list(color), 1]

    if (
        isinstance(value, (list, tuple))
        and value
        and isinstance(value[0], (int, float))
    ):
        rgba = list(value) + [1.0] * (4 - len(value))
        return [float(component) for component in rgba[:4]]

    raise ValueError(f"Could not interpret color value: {value!r}")
