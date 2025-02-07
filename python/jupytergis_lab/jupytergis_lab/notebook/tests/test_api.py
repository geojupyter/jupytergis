import os
import unittest

from jupytergis_lab import GISDocument


class VectorTileTests(unittest.TestCase):
    def setUp(self):
        self.doc = GISDocument()


class TiffLayerTests(unittest.TestCase):
    def setUp(self):
        self.doc = GISDocument()

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

        tif_layer = self.doc.add_tiff_layer(
            url="https://s2downloads.eox.at/demo/EOxCloudless/2020/rgbnir/s2cloudless2020-16bits_sinlge-file_z0-4.tif",
            color_expr=color,
        )
        assert self.doc.layers[tif_layer]["parameters"]["color"] == color
