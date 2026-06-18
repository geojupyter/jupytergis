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


def hex_to_rgba(hex_color: str) -> tuple[int, int, int, float]:
    """Convert a CSS hex string (``#rgb``, ``#rrggbb``, ``#rrggbbaa``) to an
    ``(r, g, b, a)`` tuple with r/g/b in 0-255 and a in 0-1.

    :raises ValueError: if the input is not a supported hex length.
    """
    s = hex_color.lstrip("#")
    if len(s) == 3:
        r, g, b = (int(c * 2, 16) for c in s)
        return r, g, b, 1.0
    if len(s) == 6:
        r, g, b = (int(s[i : i + 2], 16) for i in (0, 2, 4))
        return r, g, b, 1.0
    if len(s) == 8:
        r, g, b, a = (int(s[i : i + 2], 16) for i in (0, 2, 4, 6))
        return r, g, b, a / 255
    raise ValueError(f"Invalid hex color: {hex_color}")


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
