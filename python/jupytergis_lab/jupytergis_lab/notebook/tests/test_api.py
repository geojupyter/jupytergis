import pytest
from jupytergis_core.schema import LayerType, SourceType
from pycrdt import Map
from pydantic import ValidationError

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
        self.doc._is_ready = True
        tif_layer = self.doc.add_geotiff_layer(url=TEST_TIF)
        assert self.doc.layers == [tif_layer]


class TestGeoPackageVectorLayer(TestDocument):
    def test_sourcelayer(self):
        self.doc._is_ready = True
        gpkg_layers = self.doc.add_geopackage_vector_layer(TEST_GPKG_VECTOR)
        assert [layer._id for layer in self.doc.layers] == [
            layer._id for layer in gpkg_layers
        ]


class TestGeoPackageRasterLayer(TestDocument):
    def test_sourcelayer(self):
        self.doc._is_ready = True
        gpkg_layers = self.doc.add_geopackage_raster_layer(TEST_GPKG_RASTER)
        assert [layer._id for layer in self.doc.layers] == [
            layer._id for layer in gpkg_layers
        ]


class TestGeoParquetLayer(TestDocument):
    def test_sourcelayer(self):
        self.doc._is_ready = True
        geoparquet_layer = self.doc.add_geoparquet_layer(
            TEST_GEOPARQUET,
        )
        state = geoparquet_layer._get_parameter("symbologyState")
        assert state is not None


class TestLayerAndSourceObjects(TestDocument):
    RASTER_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"

    def setup_method(self):
        super().setup_method()
        self.doc._is_ready = True

    def test_layers_read_back_as_objects(self):
        layer = self.doc.add_raster_layer(url=self.RASTER_URL, name="Basemap")

        assert self.doc.layers == [layer]
        assert layer._id in self.doc.layer_tree
        assert layer.name == "Basemap"
        assert layer.type == LayerType.RasterLayer
        assert layer.visible is True

    def test_layer_reaches_its_own_source(self):
        source = self.doc.add_raster_layer(url=self.RASTER_URL, name="Basemap").source

        assert source is not None
        assert source.type == SourceType.RasterSource
        assert source.url == self.RASTER_URL
        assert source._get_parameter("url") == self.RASTER_URL

    def test_sources_are_public(self):
        layer = self.doc.add_raster_layer(url=self.RASTER_URL)

        assert self.doc.sources == [layer.source]

    def test_source_lists_the_layers_using_it(self):
        layer = self.doc.add_raster_layer(url=self.RASTER_URL, name="Basemap")

        assert [user._id for user in layer.source.layers] == [layer._id]

    def test_get_layer_by_name(self):
        layer = self.doc.add_raster_layer(url=self.RASTER_URL, name="Basemap")

        assert self.doc.get_layer("Basemap")._id == layer._id

        with pytest.raises(KeyError):
            self.doc.get_layer(layer._id)

    def test_get_layer_without_a_match_raises(self):
        with pytest.raises(KeyError, match="No layer found"):
            self.doc.get_layer("Nope")

    def test_get_layer_with_an_ambiguous_name_raises(self):
        self.doc.add_raster_layer(url=self.RASTER_URL, name="Basemap")
        self.doc.add_raster_layer(url=self.RASTER_URL, name="Basemap")

        with pytest.raises(ValueError, match="2 layers are named"):
            self.doc.get_layer("Basemap")

    def test_get_source_by_name(self):
        source = self.doc.add_raster_layer(url=self.RASTER_URL, name="Basemap").source

        assert self.doc.get_source(source.name)._id == source._id

    def test_unknown_types_read_back_with_raw_parameters(self):
        # A type this version has no model for still has to read back, rather
        # than disappear or be relabelled as whichever model fits its keys.
        self.doc._sources["source-1"] = {
            "name": "Shapes",
            "type": "ShapefileSource",
            "parameters": {"path": "shapes.shp"},
        }
        self.doc._layers["layer-1"] = {
            "name": "Shapes",
            "type": "StacLayer",
            "visible": True,
            "parameters": {"source": "source-1", "opacity": 0.5},
        }

        layer = self.doc.get_layer("Shapes")

        assert isinstance(layer._parameters, dict)
        assert layer._get_parameter("opacity") == 0.5
        assert layer.source.name == "Shapes"
        assert isinstance(self.doc.get_source("Shapes")._parameters, dict)

    def test_unknown_parameters_are_not_dropped(self):
        self.doc._layers["layer-1"] = {
            "name": "Future",
            "type": "RasterLayer",
            "visible": True,
            "parameters": {"source": "source-1", "opacity": 1.0, "unknown": 7},
        }

        assert self.doc.get_layer("Future")._get_parameter("unknown") == 7

    def test_layers_follow_the_layer_tree_with_groups_as_sub_lists(self):
        first = self.doc.add_raster_layer(url=self.RASTER_URL, name="First")
        second = self.doc.add_raster_layer(url=self.RASTER_URL, name="Second")
        self.doc._layerTree.clear()
        self.doc._layerTree.extend(
            [first._id, Map({"name": "Group", "layers": [second._id]})],
        )

        layers = self.doc.layers

        assert [layer._id for layer in layers[:1]] == [first._id]
        assert isinstance(layers[1], list)
        assert layers[1].name == "Group"
        assert [layer._id for layer in layers[1]] == [second._id]

    def test_setting_a_layer_field_updates_the_document(self):
        layer = self.doc.add_raster_layer(url=self.RASTER_URL, name="Basemap")

        layer.visible = False

        assert self.doc._layers[layer._id]["visible"] is False

    def test_parameters_are_not_exposed(self):
        layer = self.doc.add_raster_layer(url=self.RASTER_URL, name="Basemap")

        assert not hasattr(layer, "parameters")

    def test_parameters_read_and_write_as_attributes(self):
        layer = self.doc.add_raster_layer(url=self.RASTER_URL, name="Basemap")
        url = "https://example.com/{z}/{y}/{x}"

        layer.opacity = 0.5
        layer.source.url = url

        assert layer.opacity == 0.5
        assert self.doc._layers[layer._id]["parameters"]["opacity"] == 0.5
        assert layer.source.url == url
        assert self.doc._sources[layer.source._id]["parameters"]["url"] == url
        assert "opacity" in dir(layer)

    def test_raw_parameters_read_and_write_as_attributes(self):
        self.doc._layers["layer-1"] = {
            "name": "Shapes",
            "type": "StacLayer",
            "visible": True,
            "parameters": {"opacity": 0.5},
        }
        layer = self.doc.get_layer("Shapes")

        layer.opacity = 0.2

        assert layer.opacity == 0.2
        assert self.doc._layers["layer-1"]["parameters"]["opacity"] == 0.2

    def test_layer_source_is_the_source_object_not_its_id(self):
        layer = self.doc.add_raster_layer(url=self.RASTER_URL, name="Basemap")

        assert layer.source._id == layer._get_parameter("source")

    def test_unknown_attribute_raises(self):
        layer = self.doc.add_raster_layer(url=self.RASTER_URL, name="Basemap")

        with pytest.raises(AttributeError):
            _ = layer.nope


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
            == "colorMap"
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
        assert scale["scheme"] == "colorMap"

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
        self.doc._is_ready = True
        layer = self.doc.add_geojson_layer(
            data=SAMPLE_GEOJSON,
            name="Quakes",
            symbology=[[constant("#00FF00").encoding("fill")]],
        )
        state = layer._get_parameter("symbologyState")
        assert state.layers is not None
        assert len(state.layers) == 1
        assert len(state.layers[0].rules) >= 1

    def test_setting_symbology_on_a_layer_updates_the_document(self):
        self.doc._is_ready = True
        layer = self.doc.add_geojson_layer(data=SAMPLE_GEOJSON, name="Quakes")

        layer.symbology = [[constant("#00FF00").encoding("fill")]]

        stored = self.doc._layers[layer._id]["parameters"]["symbologyState"]
        assert len(stored["layers"]) == 1
        assert len(layer.symbology.layers) == 1

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
        layer = self.doc.add_geoZarr_layer(url="http://example.com/data.zarr")
        assert self.doc.layers == [layer]

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
        self.doc._is_ready = True
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
        self.doc._is_ready = True
        layer_id = self.doc.add_geojson_layer(data=SAMPLE_GEOJSON, name="Quakes")
        self.doc._path = "project.qgz"
        with pytest.raises(RuntimeError, match="Convert it to jGIS first"):
            self.doc.apply_symbology(
                layer_id,
                [[vega_expr("datum.mag * 2").encoding("radius")]],
            )

    def test_expression_symbology_allowed_on_jgis_document(self):
        self.doc._is_ready = True
        layer = self.doc.add_geojson_layer(
            data=SAMPLE_GEOJSON,
            name="Quakes",
            symbology=[[vega_expr("datum.mag * 2").encoding("radius")]],
        )
        assert self.doc.layers == [layer]


def _feature_stores(doc: GISDocument) -> dict:
    return doc._featureStores.to_py() or {}


class TestFeatureStores(TestDocument):
    def test_feature_stores_empty_by_default(self):
        assert _feature_stores(self.doc) == {}

    def test_feature_stores_reads_overlay(self):
        store = Map()
        self.doc._featureStores["store-1"] = store
        store["meta"] = {
            "softLimit": 1,
            "hardLimit": 2,
            "compacting": False,
        }
        features = Map()
        store["features"] = features
        features["f1"] = {
            "id": "f1",
            "geometry": {"type": "Point", "coordinates": [0, 0]},
            "props": {},
            "updatedAt": "t",
            "updatedBy": "u",
        }

        stores = _feature_stores(self.doc)
        assert stores["store-1"]["features"]["f1"]["id"] == "f1"
        assert stores["store-1"]["meta"]["compacting"] is False


class TestLayerManipulation(TestDocument):
    def test_add_and_remove_layer_and_source(self):
        self.doc._is_ready = True
        layer_id = self.doc.add_geotiff_layer(url=TEST_TIF)
        assert len(self.doc.layers) == 1

        self.doc.remove_layer(layer_id)
        assert len(self.doc.layers) == 0
        assert len(self.doc._sources) == 0

    def test_remove_nonexistent_layer_raises(self):
        with pytest.raises(KeyError):
            self.doc.remove_layer("foo")


class TestStoryMap(TestDocument):
    def test_add_segment_creates_the_story(self):
        self.doc._is_ready = True
        segment = self.doc.add_story_segment(center=(2.0, 47.0), zoom=5)

        assert self.doc.story["title"] == "New Story"
        assert self.doc.story["storyType"] == "guided"
        assert self.doc.story_segments == [segment._id]
        assert segment.type == LayerType.StorySegmentLayer

    def test_segments_keep_insertion_order(self):
        self.doc._is_ready = True
        first = self.doc.add_story_segment(center=(2.0, 47.0), zoom=5)
        second = self.doc.add_story_segment(center=(3.0, 48.0), zoom=6)

        assert self.doc.story_segments == [first._id, second._id]
        assert first.name == "Story Segment"
        assert second.name == "Story Segment 1"

    def test_center_is_projected_to_the_view_projection(self):
        self.doc._is_ready = True
        segment = self.doc.add_story_segment(center=(2.0, 47.0), zoom=5)

        extent = self.doc._layers[segment._id]["parameters"]["extent"]
        assert extent[0] == pytest.approx(222638.98, abs=0.01)
        assert extent[1] == pytest.approx(5942074.07, abs=0.01)
        assert extent[0] == extent[2]
        assert extent[1] == extent[3]

    def test_extent_is_projected_to_the_view_projection(self):
        self.doc._is_ready = True
        segment = self.doc.add_story_segment(
            extent=[2.0, 47.0, 3.0, 48.0],
            zoom=5,
        )

        extent = self.doc._layers[segment._id]["parameters"]["extent"]
        assert extent[0] == pytest.approx(222638.98, abs=0.01)
        assert extent[2] == pytest.approx(333958.47, abs=0.01)

    def test_center_defaults_to_the_map_center(self):
        doc = GISDocument(latitude=47.0, longitude=2.0, zoom=5)
        doc._is_ready = True
        segment = doc.add_story_segment()

        parameters = doc._layers[segment._id]["parameters"]
        assert parameters["zoom"] == 5
        assert parameters["extent"][0] == pytest.approx(222638.98, abs=0.01)

    def test_extent_and_center_together_raise(self):
        self.doc._is_ready = True
        with pytest.raises(ValueError, match="at the same time"):
            self.doc.add_story_segment(
                center=(2.0, 47.0),
                extent=[2, 47, 3, 48],
                zoom=5,
            )

    def test_markdown_switches_the_content_mode(self):
        self.doc._is_ready = True
        segment = self.doc.add_story_segment(
            center=(2.0, 47.0),
            zoom=5,
            markdown="# Title",
            image="https://example.com/a.png",
            image_caption="A caption",
        )

        content = self.doc._layers[segment._id]["parameters"]["content"]
        assert content["contentMode"] == "markdown"
        assert content["markdown"] == "# Title"
        assert content["image"] == "https://example.com/a.png"
        assert content["imageCaption"] == "A caption"

    def test_transition_and_identify_are_persisted(self):
        self.doc._is_ready = True
        segment = self.doc.add_story_segment(
            center=(2.0, 47.0),
            zoom=5,
            transition="smooth",
            transition_time=2.5,
            enable_identify=True,
        )

        parameters = self.doc._layers[segment._id]["parameters"]
        assert parameters["transition"] == {"type": "smooth", "time": 2.5}
        assert parameters["enableIdentify"] is True

    def test_layer_overrides_are_persisted(self):
        self.doc._is_ready = True
        layer = self.doc.add_geojson_layer(data=SAMPLE_GEOJSON, name="Quakes")
        segment = self.doc.add_story_segment(
            center=(2.0, 47.0),
            zoom=5,
            layer_overrides=[{"targetLayer": layer._id, "visible": False}],
        )

        overrides = self.doc._layers[segment._id]["parameters"]["layerOverride"]
        assert overrides[0]["targetLayer"] == layer._id
        assert overrides[0]["visible"] is False

    def test_create_story_then_add_segment(self):
        self.doc._is_ready = True
        story_id = self.doc.create_story(
            title="My story",
            story_type="Vertical Scroll",
            presentation_bg_color="#111111",
        )
        segment = self.doc.add_story_segment(center=(2.0, 47.0), zoom=5)

        assert self.doc._selected_story()[0] == story_id
        assert self.doc.story["title"] == "My story"
        assert self.doc.story["storyType"] == "Vertical Scroll"
        assert self.doc.story["presentationBgColor"] == "#111111"
        assert self.doc.story_segments == [segment._id]

    def test_create_story_twice_raises(self):
        self.doc._is_ready = True
        self.doc.create_story()
        with pytest.raises(ValueError, match="already has a story"):
            self.doc.create_story()

    def test_update_story_keeps_untouched_properties(self):
        self.doc._is_ready = True
        self.doc.create_story(title="My story", story_panel_opacity=0.5)
        self.doc.add_story_segment(center=(2.0, 47.0), zoom=5)
        self.doc.update_story(title="Renamed")

        assert self.doc.story["title"] == "Renamed"
        assert self.doc.story["storyPanelOpacity"] == 0.5
        assert len(self.doc.story_segments) == 1

    def test_update_story_without_story_raises(self):
        self.doc._is_ready = True
        with pytest.raises(ValueError, match="has no story"):
            self.doc.update_story(title="Renamed")

    def test_invalid_story_type_raises(self):
        self.doc._is_ready = True
        with pytest.raises(ValidationError):
            self.doc.create_story(story_type="scroll")

    def test_invalid_content_mode_raises(self):
        self.doc._is_ready = True
        with pytest.raises(ValidationError):
            self.doc.add_story_segment(center=(2.0, 47.0), zoom=5, content_mode="text")

    def test_remove_segment_drops_it_from_the_story(self):
        self.doc._is_ready = True
        first = self.doc.add_story_segment(center=(2.0, 47.0), zoom=5)
        second = self.doc.add_story_segment(center=(3.0, 48.0), zoom=6)

        self.doc.remove_layer(first)

        assert first._id not in self.doc._layers
        assert self.doc.story_segments == [second._id]

    def test_remove_a_layer_while_a_segment_exists(self):
        self.doc._is_ready = True
        layer_id = self.doc.add_geojson_layer(data=SAMPLE_GEOJSON, name="Quakes")
        self.doc.add_story_segment(center=(2.0, 47.0), zoom=5)

        self.doc.remove_layer(layer_id)

        assert layer_id not in self.doc.layers

    def test_story_is_blocked_on_qgis_documents(self):
        self.doc._is_ready = True
        self.doc._path = "project.qgz"

        with pytest.raises(RuntimeError, match="Convert it to jGIS first"):
            self.doc.create_story()
        with pytest.raises(RuntimeError, match="Convert it to jGIS first"):
            self.doc.add_story_segment(center=(2.0, 47.0), zoom=5)

        assert self.doc.story is None
