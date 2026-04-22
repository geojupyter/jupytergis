from datetime import date, timedelta
from unittest import mock

import pytest
from xyzservices import TileProvider

from layer_gallery.models import LayerEntry, ThumbnailConfig, XYZServicesRef
from layer_gallery.utils import build_url_parameters, resolve_tile_provider

from .helpers import make_geojson_entry, make_raster_entry


class TestResolveTileProvider:
    @mock.patch(
        "layer_gallery.models.xyzcatalog",
        {
            "Esri": {
                "WorldGrayCanvas": TileProvider(
                    name="Esri.WorldGrayCanvas",
                    url="https://example.com/{z}/{x}/{y}",
                    attribution="Esri",
                    max_zoom=16,
                ),
            },
        },
    )
    def test_resolve_tile_provider_from_xyz_nested(self) -> None:
        entry = make_raster_entry(use_xyz=True)
        tp = resolve_tile_provider(entry)
        assert tp is not None
        assert tp["name"] == "Esri.WorldGrayCanvas"

    @mock.patch(
        "layer_gallery.models.xyzcatalog",
        {
            "OPNVKarte": TileProvider(
                name="OPNVKarte",
                url="https://tileserver.memomaps.de/tilegen/{z}/{x}/{y}.png",
                attribution="memomaps",
                max_zoom=18,
            ),
        },
    )
    def test_resolve_tile_provider_from_xyz_flat(self) -> None:
        entry = LayerEntry(
            name="OPNVKarte",
            layer_type="RasterLayer",
            source_type="RasterSource",
            data_source=XYZServicesRef(["OPNVKarte"]),
            thumbnail=ThumbnailConfig(lat=0, lng=0, zoom=5),
        )
        tp = resolve_tile_provider(entry)
        assert tp is not None
        assert tp["name"] == "OPNVKarte"

    def test_resolve_tile_provider_from_tile_provider(self) -> None:
        entry = make_raster_entry(use_xyz=False)
        tp = resolve_tile_provider(entry)
        assert tp is not None
        assert tp["name"] == "Esri.WorldGrayCanvas"

    def test_resolve_tile_provider_for_geojson_returns_none(self) -> None:
        entry = make_geojson_entry()
        assert resolve_tile_provider(entry) is None


class TestBuildUrlParameters:
    def test_build_url_parameters_substitutes_yesterday_for_empty_time(self) -> None:
        tp = TileProvider(
            name="NASAGIBS.Test",
            url="https://gibs.example.com/{time}/{z}/{y}/{x}.jpg",
            attribution="NASA",
            max_zoom=9,
            time="",
        )
        params = build_url_parameters(tp)
        expected_date = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")
        assert params == {"time": expected_date}

    def test_build_url_parameters_passes_through_static_values(self) -> None:
        tp = TileProvider(
            name="Esri.Test",
            url="https://example.com/{variant}/tile/{z}/{y}/{x}",
            attribution="Esri",
            max_zoom=16,
            variant="Canvas/World_Light_Gray_Base",
        )
        params = build_url_parameters(tp)
        assert params == {"variant": "Canvas/World_Light_Gray_Base"}

    def test_build_url_parameters_raises_for_missing_placeholder(self) -> None:
        tp = TileProvider(
            name="Bad.Provider",
            url="https://example.com/{apikey}/{z}/{y}/{x}",
            attribution="Test",
            max_zoom=18,
        )
        with pytest.raises(KeyError, match="apikey"):
            build_url_parameters(tp)
