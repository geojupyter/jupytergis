import os

import pytest

from jupytergis_lab import GISDocument

TEST_TIF = "https://s2downloads.eox.at/demo/EOxCloudless/2020/rgbnir/s2cloudless2020-16bits_sinlge-file_z0-4.tif"


class TestDocument:
    def setup_method(self):
        self.doc = GISDocument()


class TestTiffLayer(TestDocument):
    def test_sourcelayer(self):
        color = self.doc.create_color_expr(
            interpolation_type="linear",
            band=1,
            color_stops={
                0.1: [246.0, 97.0, 81.0, 1.0],
                0.25: [248.0, 228.0, 92.0, 1.0],
                0.5: [255.0, 190.0, 111.0, 1.0],
                0.75: [143.0, 240.0, 164.0, 1.0],
                1.0: [153.0, 193.0, 241.0, 1.0],
            },
        )

        tif_layer = self.doc.add_tiff_layer(url=TEST_TIF, color_expr=color)
        assert self.doc.layers[tif_layer]["parameters"]["color"] == color


class TestLayerManipulation(TestDocument):
    def test_add_and_remove_layer_and_source(self):
        layer_id = self.doc.add_tiff_layer(url=TEST_TIF)
        assert len(self.doc.layers) == 1

        # After removing the layer, the source is not associated with any layer, so we
        # expect it to be removed as well.
        self.doc.remove_layer(layer_id)
        assert len(self.doc.layers) == 0
        assert len(self.doc._sources) == 0

    def test_remove_nonexistent_layer_raises(self):
        with pytest.raises(KeyError):
            self.doc.remove_layer("foo")
