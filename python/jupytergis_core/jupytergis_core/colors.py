"""Shared color parsing utilities.

Used by both ``jupytergis_qgis`` (QGIS import/export) and ``jupytergis_lab``
(notebook GIS API) so hex ↔ rgba conversions are defined in exactly one place.
"""

from __future__ import annotations


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


def try_hex_to_rgba(hex_color: str) -> tuple[int, int, int, float] | None:
    """Non-raising variant of :func:`hex_to_rgba`. Returns ``None`` on any
    parse failure instead of raising.
    """
    if not isinstance(hex_color, str):
        return None
    try:
        return hex_to_rgba(hex_color)
    except ValueError:
        return None


def rgb_to_hex(rgb_str: str) -> str:
    """Convert a comma-separated ``"r,g,b"`` (or ``"r,g,b,a"``) string to a
    ``#rrggbb`` hex code. Any channel past the first three is ignored.
    """
    parts = rgb_str.split(",")[:3]
    r, g, b = (int(val) for val in parts)
    return f"#{r:02x}{g:02x}{b:02x}"
