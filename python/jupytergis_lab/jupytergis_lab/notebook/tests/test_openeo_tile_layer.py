import asyncio
from types import SimpleNamespace
from unittest.mock import MagicMock

from jupytergis_lab import GISDocument
from jupytergis_lab.notebook.gis_document import _ensure_save_result

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
            list_service_types=lambda: {"XYZ": True},
            validate_process_graph=lambda _graph: [],
            create_service=lambda _graph, _type: SimpleNamespace(
                describe_service=lambda: {
                    "url": "http://127.0.0.1:8080/bli-bla-blou/{z}/{x}/{y}",
                },
            ),
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


def _graph_without_save_result():
    return {
        "loadcollection1": {
            "process_id": "load_collection",
            "arguments": {"id": "sentinel-2-global-mosaics", "spatial_extent": BBOX},
        },
        "ndvi1": {
            "process_id": "ndvi",
            "arguments": {"data": {"from_node": "loadcollection1"}},
            "result": True,
        },
    }


class TestEnsureSaveResult:
    def test_adds_save_result_over_the_result_node(self):
        graph = _ensure_save_result(_graph_without_save_result())

        assert "result" not in graph["ndvi1"]
        assert graph["saveresult1"] == {
            "arguments": {
                "data": {"from_node": "ndvi1"},
                "format": "PNG",
                "options": {},
            },
            "process_id": "save_result",
            "result": True,
        }

    def test_leaves_graph_with_save_result_unchanged(self):
        graph = _fake_graph(BBOX).flat_graph()

        assert _ensure_save_result(graph) is graph

    def test_leaves_graph_without_result_node_unchanged(self):
        graph = _graph_without_save_result()
        del graph["ndvi1"]["result"]

        assert _ensure_save_result(graph) is graph

    def test_mints_a_non_colliding_key(self):
        graph = _graph_without_save_result()
        graph["saveresult1"] = {"process_id": "linear_scale_range", "arguments": {}}

        result = _ensure_save_result(graph)

        assert result["saveresult1"] == graph["saveresult1"]
        assert result["saveresult2"]["process_id"] == "save_result"

    def test_does_not_mutate_the_input(self):
        graph = _graph_without_save_result()

        _ensure_save_result(graph)

        assert graph == _graph_without_save_result()


class TestOpenEOTileLayerSaveResult:
    def setup_method(self):
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        self.doc = GISDocument()
        self.doc._is_ready = True
        self.doc._comm.send = MagicMock()

    def teardown_method(self):
        self._loop.close()

    def test_service_and_source_get_a_graph_ending_in_save_result(self):
        graph = _fake_graph(BBOX)
        flat = _graph_without_save_result()
        graph.flat_graph = lambda: flat
        create_service = MagicMock(
            return_value=SimpleNamespace(
                describe_service=lambda: {"url": "http://127.0.0.1:8080/x/{z}/{x}/{y}"},
            ),
        )
        graph.connection.create_service = create_service

        self.doc.add_openeo_tile_layer(graph, name="NDVI")

        sent_graph = create_service.call_args.args[0]
        assert sent_graph["saveresult1"]["process_id"] == "save_result"
        source = next(iter(self.doc._sources.to_py().values()))
        assert source["parameters"]["processGraph"] == sent_graph
