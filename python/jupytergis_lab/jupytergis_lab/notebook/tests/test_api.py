import pytest

from jupytergis_lab import GISDocument
from jupytergis_lab.notebook.gis_document import QGIS_UNSUPPORTED_TYPES
from jupytergis_lab.notebook.symbology import (
    cluster,
    constant,
    field,
    heatmap,
    to_symbology_state,
    vega_expr,
    when,
)

TEST_TIF = "https://s2downloads.eox.at/demo/EOxCloudless/2020/rgbnir/s2cloudless2020-16bits_sinlge-file_z0-4.tif"
TEST_GPKG_VECTOR = "https://raw.githubusercontent.com/richard-thomas/ol-load-geopackage/master/examples/dist/Natural_Earth_QGIS_layers_and_styles.gpkg"
TEST_GPKG_RASTER = "https://raw.githubusercontent.com/ngageoint/geopackage-js/master/test/fixtures/denver_tile.gpkg"
TEST_GEOPARQUET = "https://raw.githubusercontent.com/opengeospatial/geoparquet/main/examples/example.parquet"

SAMPLE_GEOJSON = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [0, 0]},
            "properties": {"mag": 1.0},
        },
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [1, 1]},
            "properties": {"mag": 5.0},
        },
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [2, 2]},
            "properties": {"mag": 9.0},
        },
    ],
}


def _grammar_scales(state: dict, layer_idx: int = 0) -> list[dict]:
    try:
        rules = state["layers"][layer_idx]["rules"]
        return [m["scale"] for r in rules for m in r["mappings"]]
    except (KeyError, IndexError):
        return []


class TestDocument:
    def setup_method(self):
        self.doc = GISDocument()


class TestTiffLayer(TestDocument):
    def test_sourcelayer(self):
        tif_layer = self.doc.add_geotiff_layer(url=TEST_TIF)
        assert self.doc.layers[tif_layer]


class TestGeoPackageVectorLayer(TestDocument):
    def test_sourcelayer(self):
        gpkg_layers = self.doc.add_geopackage_vector_layer(TEST_GPKG_VECTOR)
        assert all(name in self.doc.layers for name in gpkg_layers)


class TestGeoPackageRasterLayer(TestDocument):
    def test_sourcelayer(self):
        gpkg_layers = self.doc.add_geopackage_raster_layer(TEST_GPKG_RASTER)
        assert all(name in self.doc.layers for name in gpkg_layers)


class TestGeoParquetLayer(TestDocument):
    def test_sourcelayer(self):
        geoparquet_layer = self.doc.add_geoparquet_layer(
            TEST_GEOPARQUET,
        )
        state = self.doc.layers[geoparquet_layer]["parameters"]["symbologyState"]
        assert "layers" in state


class TestGrammarSymbologyBuilders:
    def test_single_list_of_mappings_is_single_layer(self):
        state = to_symbology_state(
            [
                constant("green").encoding("fill"),
                constant("white").encoding("stroke"),
            ],
        )
        assert len(state["layers"]) == 1
        assert len(state["layers"][0]["rules"]) == 2

    def test_chain_constant_and_field_scale(self):
        symbology = [
            [
                constant(2).encoding("stroke-width"),
                field("mag").colormap("viridis").encoding("fill"),
            ],
        ]
        state = to_symbology_state(symbology)
        assert len(state["layers"]) == 1
        assert len(state["layers"][0]["rules"]) == 2
        assert (
            state["layers"][0]["rules"][0]["mappings"][0]["scale"]["scheme"]
            == "constant_num"
        )
        assert (
            state["layers"][0]["rules"][1]["mappings"][0]["scale"]["scheme"]
            == "colorRamp"
        )

    def test_chain_when_and_when_op(self):
        state = to_symbology_state(
            [
                [
                    when(field("mag") >= 5)
                    .field("mag")
                    .identity()
                    .when_op("all")
                    .encoding("radius"),
                ],
            ],
        )
        rule = state["layers"][0]["rules"][0]
        assert rule["whenOp"] == "all"
        assert rule["when"][0]["type"] == "fieldCompare"

    def test_when_first_constant_mapping(self):
        state = to_symbology_state(
            [
                [
                    when(field("mag") >= 5).constant("red").encoding("fill"),
                ],
            ],
        )
        rule = state["layers"][0]["rules"][0]
        assert rule["when"][0]["type"] == "fieldCompare"
        assert rule["mappings"][0]["scale"]["scheme"] == "constant_rgba"

    def test_colormap_builds_colorramp_scale(self):
        state = to_symbology_state(
            [
                [
                    field("mag").colormap("viridis").encoding("fill"),
                ],
            ],
        )
        scale = state["layers"][0]["rules"][0]["mappings"][0]["scale"]
        assert scale["scheme"] == "colorRamp"

    def test_categorical_accepts_colormap_attribute(self):
        state = to_symbology_state(
            [
                [
                    field("landuse").categorical(colormap="viridis").encoding("fill"),
                ],
            ],
        )
        scale = state["layers"][0]["rules"][0]["mappings"][0]["scale"]
        assert scale["scheme"] == "categorical"
        assert scale["params"]["colorRamp"] == "viridis"

    def test_categorical_defaults_colormap(self):
        state = to_symbology_state(
            [
                [
                    field("landuse").categorical().encoding("fill"),
                ],
            ],
        )
        scale = state["layers"][0]["rules"][0]["mappings"][0]["scale"]
        assert scale["scheme"] == "categorical"
        assert scale["params"]["colorRamp"] == "viridis"

    def test_mixing_scales_raises(self):
        with pytest.raises(TypeError):
            field("mag").identity().scalar(domain=(0, 1), output_range=(1, 3))

        with pytest.raises(TypeError):
            field("mag").colormap("viridis").categorical(colormap="viridis")

    def test_unfinished_chain_requires_encoding(self):
        with pytest.raises(TypeError, match="encoding"):
            to_symbology_state(
                [
                    field("mag").scalar(domain=(0, 1), output_range=(1, 3)),
                ],
            )

    def test_heatmap_accepts_mapping_list(self):
        state = to_symbology_state(
            [
                heatmap(
                    radius=20,
                    blur=30,
                    weight="mag",
                    mappings=[field("mag").colormap("viridis").encoding("fill")],
                ),
            ],
        )
        assert len(state["layers"]) == 1
        layer = state["layers"][0]
        assert layer["preprocess"][0]["type"] == "kde"
        assert len(layer["rules"]) == 1

    def test_cluster_accepts_mapping_list(self):
        state = to_symbology_state(
            [
                cluster(
                    radius=20,
                    mappings=[field("mag").identity().encoding("radius")],
                ),
            ],
        )
        assert len(state["layers"]) == 1
        layer = state["layers"][0]
        assert layer["preprocess"][0]["type"] == "cluster"
        assert len(layer["rules"]) == 1


class TestGeoJSONGrammarSymbology(TestDocument):
    def test_add_geojson_layer_persists_fill_symbology_as_layers_only(self):
        layer_id = self.doc.add_geojson_layer(
            data=SAMPLE_GEOJSON,
            name="Quakes",
            symbology=[[constant("#00FF00").encoding("fill")]],
        )
        state = self.doc.layers[layer_id]["parameters"]["symbologyState"]
        assert "layers" in state
        assert len(state["layers"]) == 1
        assert len(state["layers"][0]["rules"]) >= 1

    def test_apply_symbology_overwrites_with_grammar_state(self):
        # TODO implement it
        pass

    def test_legacy_geojson_style_kwargs_are_rejected(self):
        with pytest.raises(TypeError):
            self.doc.add_geojson_layer(
                data=SAMPLE_GEOJSON,
                logical_op="all",
                feature="mag",
                operator=">",
                value=5,
            )


class TestQgisUnsupportedFeatures(TestDocument):
    def test_jgis_document_allows_unsupported_layers(self):
        assert not self.doc._is_qgis_document
        layer_id = self.doc.add_geoZarr_layer(url="http://example.com/data.zarr")
        assert self.doc.layers[layer_id]

    @pytest.mark.parametrize("ext", [".qgz", ".qgs", ".QGZ"])
    def test_qgis_document_is_detected(self, ext):
        self.doc._path = f"project{ext}"
        assert self.doc._is_qgis_document

    def test_geozarr_layer_blocked_on_qgis_document(self):
        self.doc._path = "project.qgz"
        with pytest.raises(RuntimeError, match="Convert it to jGIS first"):
            self.doc.add_geoZarr_layer(url="http://example.com/data.zarr")
        # Nothing should have been added.
        assert len(self.doc.layers) == 0
        assert len(self.doc._sources) == 0

    @pytest.mark.parametrize("object_type", sorted(QGIS_UNSUPPORTED_TYPES, key=str))
    def test_unsupported_types_are_blocked_on_qgis_document(self, object_type):
        self.doc._path = "project.qgz"
        with pytest.raises(RuntimeError, match="Convert it to jGIS first"):
            self.doc._ensure_qgis_supported(object_type)

    def test_unsupported_types_are_allowed_on_jgis_document(self):
        for object_type in QGIS_UNSUPPORTED_TYPES:
            self.doc._ensure_qgis_supported(object_type)  # does not raise

    def test_expression_symbology_blocked_on_add_layer(self):
        self.doc._path = "project.qgz"
        with pytest.raises(RuntimeError, match="Convert it to jGIS first"):
            self.doc.add_geojson_layer(
                data=SAMPLE_GEOJSON,
                name="Quakes",
                symbology=[[vega_expr("datum.mag * 2").encoding("radius")]],
            )
        # Nothing should have been added.
        assert len(self.doc.layers) == 0

    def test_expression_symbology_blocked_on_apply(self):
        layer_id = self.doc.add_geojson_layer(data=SAMPLE_GEOJSON, name="Quakes")
        self.doc._path = "project.qgz"
        with pytest.raises(RuntimeError, match="Convert it to jGIS first"):
            self.doc.apply_symbology(
                layer_id,
                [[vega_expr("datum.mag * 2").encoding("radius")]],
            )

    def test_expression_symbology_allowed_on_jgis_document(self):
        layer_id = self.doc.add_geojson_layer(
            data=SAMPLE_GEOJSON,
            name="Quakes",
            symbology=[[vega_expr("datum.mag * 2").encoding("radius")]],
        )
        assert self.doc.layers[layer_id]


class TestLayerManipulation(TestDocument):
    def test_add_and_remove_layer_and_source(self):
        layer_id = self.doc.add_geotiff_layer(url=TEST_TIF)
        assert len(self.doc.layers) == 1

        self.doc.remove_layer(layer_id)
        assert len(self.doc.layers) == 0
        assert len(self.doc._sources) == 0

    def test_remove_nonexistent_layer_raises(self):
        with pytest.raises(KeyError):
            self.doc.remove_layer("foo")
