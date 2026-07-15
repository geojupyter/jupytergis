import asyncio
from unittest.mock import MagicMock

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
        # Spy on the widget comm so we can assert the transient zoom message
        # without a live kernel on the other end.
        self.doc._comm.send = MagicMock()

    def teardown_method(self):
        self._loop.close()

    def test_zoom_to_true_sends_comm_message(self):
        layer_id = self.doc.add_raster_layer(TEST_URL, zoom_to=True)

        self.doc._comm.send.assert_called_once_with(
            data={"type": "zoom-to", "layerId": layer_id},
        )

    def test_default_does_not_request_zoom(self):
        self.doc.add_raster_layer(TEST_URL)

        # Only Y-protocol sync traffic (buffers) may go over the comm; no
        # custom `zoom-to` message should be sent.
        for call in self.doc._comm.send.call_args_list:
            assert call.kwargs.get("data") is None

    def test_zoom_to_does_not_leak_onto_the_layer(self):
        # zoom_to is a transient action, not persisted onto the layer object.
        layer_id = self.doc.add_raster_layer(TEST_URL, zoom_to=True)

        layer = self.doc.layers[layer_id]
        assert "zoom_to" not in layer
        assert "zoomRequest" not in layer
