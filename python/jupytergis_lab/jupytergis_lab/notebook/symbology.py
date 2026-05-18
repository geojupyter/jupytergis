from typing import Literal

from pydantic import BaseModel, Field


class BaseSymbology(BaseModel):
    type: str


RGBA = tuple[float, float, float, float]


class GraduatedStopOverride(BaseModel):
    """A single manual stop in a Graduated symbology.

    Attributes:
        value: The numeric break point. Features whose attribute value is
            ``<= value`` are colored with ``color`` (with the previous stop
            acting as the lower bound).
        color: RGBA tuple. ``r``, ``g``, ``b`` in ``0-255``; ``a`` in ``0-1``.

    """

    value: float
    color: RGBA


class GraduatedSymbology(BaseSymbology):
    """Graduated symbology config for a vector layer.

    Mirrors the frontend ``symbologyState`` (renderType: ``Graduated``).
    Stops and color expressions are computed at runtime from this state, so
    only the minimal config is persisted.

    Only ``value`` is required; every other field falls back to the same
    defaults the frontend applies when the field is absent.

    Attributes:
        value: Name of the numeric attribute to classify on.
        data: Optional sample of attribute values, used solely to derive
            ``vmin``/``vmax`` when the caller does not supply them. The
            frontend recomputes the range from the live source data; passing
            ``data`` is just a kernel-side convenience.
        method: ``"color"`` drives fill/stroke colors; ``"radius"`` drives
            circle size for point layers.
        color_ramp: Name of the color ramp (e.g. ``"viridis"``,
            ``"plasma"``, ``"magma"``).
        n_classes: Number of classification bins. Must be ``>= 1``.
        mode: Classification method. One of ``"equal interval"``,
            ``"quantile"``, ``"jenks"``, ``"pretty"``, ``"logarithmic"``.
        reverse: Reverse the color ramp.
        vmin: Lower bound of the classification range. If omitted, derived
            from ``data`` when given, otherwise computed by the frontend
            from the source.
        vmax: Upper bound of the classification range.
        fallback_color: RGBA color for features outside ``[vmin, vmax]`` or
            with null/missing attribute values.
        stroke_color: RGBA stroke color.
        stroke_width: Stroke width in pixels.
        stroke_follows_fill: When ``True``, the stroke is drawn in the same
            color as the fill instead of ``stroke_color``.
        radius: Circle radius (pixels) for point layers.
        stops_override: Manual per-stop overrides. When set, the frontend
            uses these stops instead of computing from
            ``(mode, n_classes, color_ramp)``.

    """

    type: Literal["graduated"] = "graduated"

    # The numeric attribute to classify on.
    value: str

    # Optional sample of attribute values. Used solely to derive vmin/vmax
    # when the caller does not supply them. The frontend will recompute from
    # the live source data; passing ``data`` is just a kernel-side convenience.
    data: list[float] | None = None

    # ``color`` drives fill/stroke; ``radius`` drives circle size.
    method: Literal["color", "radius"] = "color"

    color_ramp: str = "viridis"
    n_classes: int = Field(default=9, ge=1)
    mode: Literal[
        "equal interval",
        "quantile",
        "jenks",
        "pretty",
        "logarithmic",
    ] = "equal interval"
    reverse: bool = False

    # Optional explicit range. If omitted, derived from ``data`` (if given) or
    # computed by the frontend from the source.
    vmin: float | None = None
    vmax: float | None = None

    fallback_color: RGBA | None = None
    stroke_color: RGBA | None = None
    stroke_width: float | None = None
    stroke_follows_fill: bool = False
    radius: float | None = None

    # Manual per-stop overrides. When set, the frontend uses these stops
    # instead of computing from (mode, n_classes, ramp).
    stops_override: list[GraduatedStopOverride] | None = None


Symbology = GraduatedSymbology
