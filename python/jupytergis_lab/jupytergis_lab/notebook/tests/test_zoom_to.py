import asyncio

from jupytergis_lab import GISDocument

TEST_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"


class TestZoomTo:
    def setup_method(self):
        # Python 3.14: GISDocument() builds an asyncio.Future during __init__,
        # which requires a current event loop in the thread.
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        self.doc = GISDocument()
        self.doc._is_ready = True

    def teardown_method(self):
        self._loop.close()

    def test_zoom_to_true_writes_transient_request(self):
        layer_id = self.doc.add_raster_layer(TEST_URL, zoom_to=True)

        request = self.doc._zoom_request.to_py()
        assert request.get("layerId") == layer_id
        # A changing token so repeated requests are observed by the frontend.
        assert request.get("ts")

    def test_default_does_not_request_zoom(self):
        self.doc.add_raster_layer(TEST_URL)

        assert "layerId" not in self.doc._zoom_request.to_py()

    def test_zoom_to_does_not_leak_onto_the_layer(self):
        # zoom_to is a transient request, not persisted onto the layer object.
        layer_id = self.doc.add_raster_layer(TEST_URL, zoom_to=True)

        layer = self.doc.layers[layer_id]
        assert "zoom_to" not in layer
        assert "zoomRequest" not in layer
