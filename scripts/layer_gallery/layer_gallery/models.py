"""Data models for this package."""

import operator
from functools import reduce
from typing import Any, Literal

from pydantic import BaseModel, RootModel
from xyzservices import TileProvider
from xyzservices import (
    providers as xyzcatalog,
)


class ThumbnailConfig(BaseModel):
    """Configuration pertaining to generation of thumbnails for a layer."""

    lat: float
    lng: float
    zoom: int
    tile_size: int = 256


class XYZServicesRef(RootModel[list[str]]):
    """A reference to an item in the xyzservices.providers catalog.

    View <https://xyzservices.readthedocs.io/en/stable/introduction.html> for a
    full browseable accounting of the catalog.

    E.g.:
        * `["Esri", "WorldGrayCanvas"]` resolves to `xyz.Esri.WorldGrayCanvas`
        * `["OPNVKarte"]` resolves to `xyz.OPNVKarte`
    """

    def resolve(self) -> TileProvider:
        """Resolve the XYZServicesRef to a fully formed TileProvider."""
        return reduce(operator.getitem, self.root, xyzcatalog)


class GeoJSONLayer(BaseModel):
    """A layer defined by a GeoJSON file URL."""

    path: str
    attribution: str


class LayerEntry(BaseModel):
    """An entry in the layer gallery."""

    model_config = {"arbitrary_types_allowed": True}

    name: str
    layer_type: Literal["RasterLayer", "VectorTileLayer", "VectorLayer"]
    source_type: Literal["RasterSource", "VectorTileSource", "GeoJSONSource"]

    # TODO: pre-validate to resolve xyzservices -> TileProvider, get rid of
    # _resolve_tile_provider function
    data_source: XYZServicesRef | TileProvider | GeoJSONLayer

    layer_parameters: dict[str, Any] | None = None
    thumbnail: ThumbnailConfig
    description: str | None = None

    @property
    def thumbnail_filename(self) -> str:
        """Generate filename for thumbnail."""
        return self._thumbnail_filename(self.name)

    @staticmethod
    def _thumbnail_filename(val: str) -> str:
        return val.replace(".", "-") + ".png"


type GallerySpecification = dict[str, dict[str, LayerEntry]]
