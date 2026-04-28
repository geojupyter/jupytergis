from typing import Literal

from pydantic import BaseModel, Field


class BaseSymbology(BaseModel):
    type: str


RGBA = tuple[float, float, float, float]


class GraduatedStopOverride(BaseModel):
    value: float
    color: RGBA


class GraduatedSymbology(BaseSymbology):
    """Graduated symbology config for a vector layer.

    Mirrors the frontend ``symbologyState`` (renderType: ``Graduated``).
    Stops and color expressions are computed at runtime from this state, so
    only the minimal config is persisted.
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
