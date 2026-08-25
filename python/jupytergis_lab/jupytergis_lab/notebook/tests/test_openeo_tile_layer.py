import asyncio
from types import SimpleNamespace
from unittest.mock import MagicMock

from jupytergis_lab import GISDocument

# Notebook bbox (examples/99-OpenEO-titiler-local.ipynb): a ~0.1° box over NYC.
BBOX = {"west": -74.0, "south": 40.7, "east": -73.9, "north": 40.8}


def _fake_graph(spatial_extent):
    """A minimal stand-in for an openeo datacube/result node."""
    flat = {
        "loadcollection1": {
            "process_id": "load_collection",
            "arguments": {
                "id": "sentinel-2-global-mosaics",
                "spatial_extent": spatial_extent,
            },
        },
        "saveresult1": {
            "process_id": "save_result",
            "arguments": {"data": {"from_node": "loadcollection1"}, "format": "PNG"},
            "result": True,
        },
    }
    return SimpleNamespace(
        flat_graph=lambda: flat,
        connection=SimpleNamespace(
            root_url="http://127.0.0.1:8080/",
            auth=SimpleNamespace(bearer="test"),
        ),
    )


class TestOpenEOTileLayer:
    def setup_method(self):
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        self.doc = GISDocument()
        self.doc._is_ready = True
        self.doc._comm.send = MagicMock()

    def teardown_method(self):
        self._loop.close()

    def test_fits_view_to_spatial_extent_by_default(self):
        self.doc.add_openeo_tile_layer(_fake_graph(BBOX), name="NDVI")

        options = self.doc._options.to_py()
        assert options["useExtent"] is True
        # EPSG:3857 extent whose center round-trips to the bbox center
        # (lon -73.95, lat 40.75) — matching the notebook's manual view.
        minx, miny, maxx, maxy = options["extent"]
        assert minx < maxx
        assert miny < maxy
        assert abs((minx + maxx) / 2 - (-8232076.34)) < 1.0
        assert abs((miny + maxy) / 2 - 4975539.12) < 1.0

    def test_zoom_to_extent_false_leaves_view_untouched(self):
        self.doc.add_openeo_tile_layer(
            _fake_graph(BBOX),
            name="NDVI",
            zoom_to_extent=False,
        )

        options = self.doc._options.to_py()
        assert "useExtent" not in options
        assert "extent" not in options

    def test_no_spatial_extent_leaves_view_untouched(self):
        self.doc.add_openeo_tile_layer(_fake_graph(None), name="NDVI")

        options = self.doc._options.to_py()
        assert "useExtent" not in options
        assert "extent" not in options
