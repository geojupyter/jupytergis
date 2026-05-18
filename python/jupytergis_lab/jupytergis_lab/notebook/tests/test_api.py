import pytest

from jupytergis_lab import GISDocument
from jupytergis_lab.notebook.gis_document import (
    _vector_symbology_state_from_color_expr,
)
from jupytergis_lab.notebook.symbology import (
    GraduatedStopOverride,
    GraduatedSymbology,
)

TEST_TIF = "https://s2downloads.eox.at/demo/EOxCloudless/2020/rgbnir/s2cloudless2020-16bits_sinlge-file_z0-4.tif"
TEST_GPKG_VECTOR = "https://raw.githubusercontent.com/richard-thomas/ol-load-geopackage/master/examples/dist/Natural_Earth_QGIS_layers_and_styles.gpkg"
TEST_GPKG_RASTER = "https://raw.githubusercontent.com/ngageoint/geopackage-js/master/test/fixtures/denver_tile.gpkg"
TEST_GEOPARQUET = "https://raw.githubusercontent.com/opengeospatial/geoparquet/main/examples/example.parquet"


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
        color = {"fill-color": "#00FF00", "stroke-color": "#FF0000"}
        geoparquet_layer = self.doc.add_geoparquet_layer(
            TEST_GEOPARQUET,
            color_expr=color,
        )
        state = self.doc.layers[geoparquet_layer]["parameters"]["symbologyState"]
        assert "layers" in state
        scales = _grammar_scales(state)
        assert any(
            s["scheme"] == "constant_rgba" and s["params"]["value"] == [0, 255, 0, 1.0]
            for s in scales
        )
        assert any(
            s["scheme"] == "constant_rgba" and s["params"]["value"] == [255, 0, 0, 1.0]
            for s in scales
        )


def _grammar_channels(state: dict, layer_idx: int = 0) -> list[list[str]]:
    """Return the list of channel lists across all rules of the first grammar layer."""
    try:
        rules = state["layers"][layer_idx]["rules"]
        return [m["channels"] for r in rules for m in r["mappings"]]
    except (KeyError, IndexError):
        return []


def _grammar_scales(state: dict, layer_idx: int = 0) -> list[dict]:
    """Return the list of scale dicts across all rules of the first grammar layer."""
    try:
        rules = state["layers"][layer_idx]["rules"]
        return [m["scale"] for r in rules for m in r["mappings"]]
    except (KeyError, IndexError):
        return []


@pytest.mark.parametrize(
    "color_expr,n_rules,expected_channels,expected_scale_params",
    [
        pytest.param(None, 0, [], [], id="none"),
        pytest.param({}, 0, [], [], id="empty-dict"),
        pytest.param(
            {"fill-color": "#00FF00", "stroke-color": "#FF0000"},
            2,
            [
                ["fill-color", "circle-fill-color"],
                ["stroke-color", "circle-stroke-color"],
            ],
            [
                {"scheme": "constant_rgba", "params": {"value": [0, 255, 0, 1.0]}},
                {"scheme": "constant_rgba", "params": {"value": [255, 0, 0, 1.0]}},
            ],
            id="fill-and-stroke-hex",
        ),
        pytest.param(
            {"stroke-color": "#123456", "stroke-width": 3},
            2,
            [
                ["stroke-color", "circle-stroke-color"],
                ["stroke-width", "circle-stroke-width"],
            ],
            [
                {"scheme": "constant_rgba", "params": {"value": [18, 52, 86, 1.0]}},
                {"scheme": "constant_num", "params": {"value": 3}},
            ],
            id="line-with-width",
        ),
        pytest.param(
            {"circle-fill-color": "#abcdef", "circle-radius": 4.5},
            2,
            [["fill-color", "circle-fill-color"], ["circle-radius"]],
            [
                {"scheme": "constant_rgba", "params": {"value": [171, 205, 239, 1.0]}},
                {"scheme": "constant_num", "params": {"value": 4.5}},
            ],
            id="circle",
        ),
        pytest.param(
            {"fill-color": ["interpolate", ["linear"], 0.0, [0, 0, 0, 1]]},
            0,
            [],
            [],
            id="ol-expression-dropped",
        ),
    ],
)
def test_vector_symbology_state_from_color_expr(
    color_expr,
    n_rules,
    expected_channels,
    expected_scale_params,
):
    state = _vector_symbology_state_from_color_expr(color_expr)
    assert "layers" in state
    assert len(state["layers"]) == 1
    rules = state["layers"][0]["rules"]
    assert len(rules) == n_rules
    assert _grammar_channels(state) == expected_channels
    assert _grammar_scales(state) == expected_scale_params


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


class TestApplyGraduatedSymbology(TestDocument):
    """Tests for ``apply_symbology`` with ``GraduatedSymbology``.

    The kernel only persists ``symbologyState`` — stops and OL color
    expressions are computed at render time on the frontend. These tests pin
    the persisted shape so any drift from the frontend ``symbologyState``
    contract is caught here.
    """

    def _add_vector_layer(self):
        return self.doc.add_geojson_layer(data=SAMPLE_GEOJSON, name="Quakes")

    def test_minimal_state_shape(self):
        layer_id = self._add_vector_layer()
        self.doc.apply_symbology(
            layer_id,
            GraduatedSymbology(value="mag", n_classes=5),
        )

        state = self.doc.layers[layer_id]["parameters"]["symbologyState"]
        assert state == {
            "renderType": "Graduated",
            "value": "mag",
            "method": "color",
            "colorRamp": "viridis",
            "nClasses": 5.0,
            "mode": "equal interval",
            "reverseRamp": False,
            "strokeFollowsFill": False,
        }

    def test_data_sample_derives_vmin_vmax(self):
        layer_id = self._add_vector_layer()
        self.doc.apply_symbology(
            layer_id,
            GraduatedSymbology(value="mag", data=[1.0, 5.0, 9.0]),
        )

        state = self.doc.layers[layer_id]["parameters"]["symbologyState"]
        assert state["vmin"] == 1.0
        assert state["vmax"] == 9.0

    def test_explicit_vmin_vmax_wins_over_data(self):
        layer_id = self._add_vector_layer()
        self.doc.apply_symbology(
            layer_id,
            GraduatedSymbology(
                value="mag",
                data=[1.0, 5.0, 9.0],
                vmin=0.0,
                vmax=10.0,
            ),
        )

        state = self.doc.layers[layer_id]["parameters"]["symbologyState"]
        assert state["vmin"] == 0.0
        assert state["vmax"] == 10.0

    def test_partial_range_filled_from_data(self):
        layer_id = self._add_vector_layer()
        self.doc.apply_symbology(
            layer_id,
            GraduatedSymbology(value="mag", data=[1.0, 5.0, 9.0], vmin=2.0),
        )

        state = self.doc.layers[layer_id]["parameters"]["symbologyState"]
        assert state["vmin"] == 2.0
        assert state["vmax"] == 9.0

    def test_no_data_no_range_omits_vmin_vmax(self):
        layer_id = self._add_vector_layer()
        self.doc.apply_symbology(layer_id, GraduatedSymbology(value="mag"))

        state = self.doc.layers[layer_id]["parameters"]["symbologyState"]
        assert "vmin" not in state
        assert "vmax" not in state

    def test_style_fields_propagate(self):
        layer_id = self._add_vector_layer()
        self.doc.apply_symbology(
            layer_id,
            GraduatedSymbology(
                value="mag",
                fallback_color=(0, 0, 0, 0),
                stroke_color=(20, 20, 20, 1),
                stroke_width=1.5,
                stroke_follows_fill=True,
                radius=6.0,
            ),
        )

        state = self.doc.layers[layer_id]["parameters"]["symbologyState"]
        assert state["fallbackColor"] == [0, 0, 0, 0]
        assert state["strokeColor"] == [20, 20, 20, 1]
        assert state["strokeWidth"] == 1.5
        assert state["strokeFollowsFill"] is True
        assert state["radius"] == 6.0

    def test_stops_override_propagate(self):
        layer_id = self._add_vector_layer()
        self.doc.apply_symbology(
            layer_id,
            GraduatedSymbology(
                value="mag",
                stops_override=[
                    GraduatedStopOverride(value=2.0, color=(255, 0, 0, 1)),
                    GraduatedStopOverride(value=6.0, color=(0, 255, 0, 1)),
                ],
            ),
        )

        state = self.doc.layers[layer_id]["parameters"]["symbologyState"]
        assert state["stopsOverride"] == [
            {"value": 2.0, "color": [255, 0, 0, 1]},
            {"value": 6.0, "color": [0, 255, 0, 1]},
        ]

    def test_drops_legacy_color_cache(self):
        """Frontend treats ``symbologyState`` as the source of truth and drops
        ``params.color`` on save (see ``Graduated.tsx`` mutateLayerBeforeSave).
        The kernel must do the same when applying graduated symbology.
        """
        layer_id = self._add_vector_layer()
        # Stash a legacy color expression on the layer.
        self.doc._layers[layer_id]["parameters"]["color"] = {
            "fill-color": "#ff0000",
        }

        self.doc.apply_symbology(layer_id, GraduatedSymbology(value="mag"))

        assert "color" not in self.doc.layers[layer_id]["parameters"]

    def test_method_radius(self):
        layer_id = self._add_vector_layer()
        self.doc.apply_symbology(
            layer_id,
            GraduatedSymbology(value="mag", method="radius"),
        )

        state = self.doc.layers[layer_id]["parameters"]["symbologyState"]
        assert state["method"] == "radius"

    def test_unknown_layer_raises(self):
        with pytest.raises(ValueError, match="No layer found"):
            self.doc.apply_symbology(
                "does-not-exist",
                GraduatedSymbology(value="mag"),
            )

    def test_raster_layer_rejected(self):
        layer_id = self.doc.add_tiff_layer(url=TEST_TIF)
        with pytest.raises(ValueError, match="vector"):
            self.doc.apply_symbology(layer_id, GraduatedSymbology(value="mag"))

    def test_invalid_n_classes_raises(self):
        with pytest.raises(ValueError, match="greater than or equal to 1"):
            GraduatedSymbology(value="mag", n_classes=0)


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
