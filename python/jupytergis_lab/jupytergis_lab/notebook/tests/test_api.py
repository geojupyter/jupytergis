import unittest

from jupytergis_lab import GISDocument


class VectorTileTests(unittest.TestCase):

    def setUp(self):
        self.doc = GISDocument()

    def test_sourcelayer(self):
        # If there are multiple source layers available and none specified we raise
        with self.assertRaises(ValueError):
            self.doc.add_vectortile_layer("https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer/tile/{z}/{y}/{x}.pbf")

        # If there is on source layer available and none specified we select it
        vector_tile = self.doc.add_vectortile_layer("https://planetarycomputer.microsoft.com/api/data/v1/vector/collections/ms-buildings/tilesets/global-footprints/tiles/{z}/{x}/{y}")
        assert self.doc.layers[vector_tile]["parameters"]["sourceLayer"] == "bingmlbuildings"
