"""Miscellaneous utilities."""

import string
from datetime import date, timedelta
from typing import Any, cast

from xyzservices import TileProvider

from layer_gallery.models import GeoJSONLayer, LayerEntry, XYZServicesRef


def resolve_tile_provider(entry: LayerEntry) -> TileProvider | None:
    """Return the TileProvider for a LayerEntry, or None for GeoJSON entries."""
    # TODO: Always return TileProvider... raise when receiving an entry with
    # GeoJSONLayer source?
    match entry.data_source:
        case GeoJSONLayer():
            return None
        case TileProvider():
            return entry.data_source
        case XYZServicesRef():
            return entry.data_source.resolve()
        case _:
            raise RuntimeError("Programmer error.")


def build_url_parameters(tile_provider: TileProvider) -> dict[str, Any]:
    """Extract non-reserved URL template variables from a TileProvider.

    Substitutes yesterday's date for any `time` placeholder whose stored value
    is `""` (the convention used by NASAGIBS entries in config.py).
    """
    yesterday = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")
    formatter = string.Formatter()
    url_template = tile_provider["url"]
    placeholders = {
        field_name
        for _, field_name, _, _ in formatter.parse(url_template)
        if field_name
    }
    # Placeholders handled explicitly by _fetch_tile
    reserved = {"x", "y", "z", "s"}
    kwargs = {}
    for name in placeholders - reserved:
        if name not in tile_provider or tile_provider[name] is None:
            raise KeyError(
                f"Placeholder '{name}' not found in TileProvider"
                f" '{tile_provider.get('name')}'",
            )

        kwargs[name] = tile_provider[name]
        if name == "time" and tile_provider["time"] == "":
            kwargs[name] = yesterday

    return kwargs


def dict_keys_to_camel[T](obj: T) -> T:
    """Convert every dict key (recursively) in `obj` to camel case."""
    if isinstance(obj, dict):
        return cast(
            "T",
            {_snake_to_camel(k): dict_keys_to_camel(v) for k, v in obj.items()},
        )
    if isinstance(obj, list):
        return cast(
            "T",
            [dict_keys_to_camel(i) for i in obj],
        )
    return obj


def _snake_to_camel(s: str) -> str:
    """Convert snake_case to camelCase."""
    parts = s.split("_")
    return parts[0] + "".join(w.capitalize() for w in parts[1:])
