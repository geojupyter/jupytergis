import os
from pathlib import Path
from uuid import uuid4

from dirty_equals import IsPartialDict, IsStr

from ..qgis_loader import export_project_to_qgis, import_project_from_qgis

FILES = Path(__file__).parent / "files"


def test_qgis_loader():
    jgis = import_project_from_qgis(FILES / "project0.qgs")
    source_id0 = IsStr()
    source_id1 = IsStr()
    source_id2 = IsStr()
    source_id3 = IsStr()
    assert jgis == IsPartialDict(
        options={
            "bearing": 0.0,
            "pitch": 0,
            "projection": "EPSG:3857",
            "extent": [
                -25164292.70393259,
                -15184674.291019961,
                26220958.18294687,
                20663680.478501424,
            ],
            "useExtent": True,
        },
        layers={
            "_02b1b4d5_316b_4f4d_9c38_16bf10a3bcb8": {
                "name": "OpenStreetMap0",
                "parameters": {
                    "opacity": 1.0,
                    "source": source_id0,
                },
                "type": "RasterLayer",
                "visible": True,
            },
            "_097deeeb_6564_48d1_a3be_1caa4d93382f": {
                "name": "OpenStreetMap1",
                "parameters": {
                    "opacity": 1.0,
                    "source": source_id1,
                },
                "type": "RasterLayer",
                "visible": True,
            },
            "_bccce044_998d_45f9_bf6b_fe1472681cc3": {
                "name": "OpenStreetMap2",
                "parameters": {
                    "opacity": 1.0,
                    "source": source_id2,
                },
                "type": "RasterLayer",
                "visible": True,
            },
            "_32a77a2c_1756_4876_9f99_e3c7b702f86a": {
                "name": "OpenStreetMap3",
                "parameters": {
                    "opacity": 1.0,
                    "source": source_id3,
                },
                "type": "RasterLayer",
                "visible": True,
            },
        },
        layerTree=[
            "_097deeeb_6564_48d1_a3be_1caa4d93382f",
            "_02b1b4d5_316b_4f4d_9c38_16bf10a3bcb8",
            {
                "layers": [
                    "_32a77a2c_1756_4876_9f99_e3c7b702f86a",
                    "_bccce044_998d_45f9_bf6b_fe1472681cc3",
                ],
                "name": "group0",
                "visible": True,
            },
        ],
    )
    assert jgis == IsPartialDict(
        sources={
            source_id0.value: {
                "name": "OpenStreetMap0 Source",
                "type": "RasterSource",
                "parameters": {
                    "url": "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                    "maxZoom": 19,
                    "minZoom": 0,
                },
            },
            source_id1.value: {
                "name": "OpenStreetMap1 Source",
                "type": "RasterSource",
                "parameters": {
                    "url": "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                    "maxZoom": 19,
                    "minZoom": 0,
                },
            },
            source_id2.value: {
                "name": "OpenStreetMap2 Source",
                "type": "RasterSource",
                "parameters": {
                    "url": "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                    "maxZoom": 19,
                    "minZoom": 0,
                },
            },
            source_id3.value: {
                "name": "OpenStreetMap3 Source",
                "type": "RasterSource",
                "parameters": {
                    "url": "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                    "maxZoom": 19,
                    "minZoom": 0,
                },
            },
        },
    )


def _grammar(rules):
    """Wrap encoding rules in a single Grammar rendering layer."""
    return {"layers": [{"id": "layer-0", "rules": rules}]}


def _constant_rgba(value, channels):
    return {
        "scale": {"scheme": "constant_rgba", "params": {"value": value}},
        "channels": channels,
    }


def _make_rgb_tif(path):
    """Write a tiny valid 3-band byte GeoTIFF for raster tests."""
    from osgeo import gdal

    ds = gdal.GetDriverByName("GTiff").Create(str(path), 4, 4, 3, gdal.GDT_Byte)
    for band in range(1, 4):
        ds.GetRasterBand(band).Fill(band * 10)
    ds.FlushCache()
    ds = None


def _make_gray_tif(path):
    """Write a tiny single-band float GeoTIFF with a value gradient (min < max)."""
    import numpy as np
    from osgeo import gdal

    ds = gdal.GetDriverByName("GTiff").Create(str(path), 4, 4, 1, gdal.GDT_Float32)
    ds.GetRasterBand(1).WriteArray(np.arange(16, dtype="float32").reshape(4, 4))
    ds.FlushCache()
    ds = None


def _fill_mapping(symbology_state, channel="fill-color"):
    """Return (scheme, fields, params) of the mapping driving ``channel``."""
    for grammar_layer in symbology_state.get("layers", []):
        for rule in grammar_layer.get("rules", []):
            for mapping in rule.get("mappings", []):
                if channel in mapping.get("channels", []):
                    scale = mapping["scale"]
                    return scale["scheme"], rule.get("fields"), scale.get("params", {})
    return None, None, None


def test_qgis_saver():
    filename = FILES / "project1.qgz"
    if os.path.exists(filename):
        os.remove(filename)

    layer_ids = [str(uuid4()) for _ in range(7)]
    source_ids = [str(uuid4()) for _ in range(7)]

    single_symbol_state = _grammar(
        [
            {
                "id": "rule-0",
                "mappings": [
                    _constant_rgba(
                        [78.0, 164.0, 208.0, 1.0],
                        ["fill-color", "circle-fill-color"],
                    ),
                    _constant_rgba(
                        [0.0, 0.0, 0.0, 1.0],
                        ["stroke-color", "circle-stroke-color"],
                    ),
                ],
            },
        ],
    )

    graduated_state = _grammar(
        [
            {
                "id": "rule-0",
                "fields": ["POP_RANK"],
                "mappings": [
                    {
                        "scale": {
                            "scheme": "colorRamp",
                            "params": {
                                "name": "viridis",
                                "nShades": 9,
                                "mode": "equal interval",
                                "reverse": False,
                                "fallback": [0.0, 0.0, 0.0, 0.0],
                            },
                        },
                        "channels": ["fill-color", "circle-fill-color"],
                    },
                ],
            },
        ],
    )

    # The categorized layer is the roads (line) source, so its categorical colour
    # drives stroke-color (a line has no fill).
    categorized_state = _grammar(
        [
            {
                "id": "rule-0",
                "fields": ["min_label"],
                "mappings": [
                    {
                        "scale": {
                            "scheme": "categorical",
                            "params": {
                                "colorRamp": "viridis",
                                "reverse": False,
                                "fallback": [0.0, 0.0, 0.0, 0.0],
                                "colorStops": [
                                    {"stop": "City", "color": [255.0, 0.0, 0.0, 1.0]},
                                    {"stop": "Town", "color": [0.0, 0.0, 255.0, 1.0]},
                                ],
                            },
                        },
                        "channels": ["stroke-color"],
                    },
                ],
            },
        ],
    )

    vector_tile_state = _grammar(
        [
            {
                "id": "rule-0",
                "mappings": [
                    _constant_rgba([196.0, 60.0, 57.0, 1.0], ["fill-color"]),
                    _constant_rgba([229.0, 182.0, 54.0, 1.0], ["stroke-color"]),
                    _constant_rgba([225.0, 89.0, 137.0, 1.0], ["circle-fill-color"]),
                ],
            },
        ],
    )

    jgis = {
        "options": {
            "bearing": 0.0,
            "pitch": 0,
            "projection": "EPSG:3857",
            "extent": [
                -25164292.70393259,
                -15184674.291019961,
                26220958.18294687,
                20663680.478501424,
            ],
            "useExtent": True,
        },
        "layers": {
            layer_ids[0]: {
                "name": "OpenStreetMap0",
                "parameters": {"opacity": 1.0, "source": source_ids[0]},
                "type": "RasterLayer",
                "visible": True,
            },
            layer_ids[1]: {
                "name": "OpenStreetMap1",
                "parameters": {"opacity": 1.0, "source": source_ids[1]},
                "type": "RasterLayer",
                "visible": True,
            },
            layer_ids[2]: {
                "name": "Vector Tile Layer",
                "parameters": {
                    "opacity": 1.0,
                    "source": source_ids[2],
                    "symbologyState": vector_tile_state,
                },
                "type": "VectorTileLayer",
                "visible": True,
            },
            layer_ids[3]: {
                "name": "OpenStreetMap3",
                "parameters": {"opacity": 1.0, "source": source_ids[3]},
                "type": "RasterLayer",
                "visible": False,
            },
            layer_ids[4]: {
                "name": "Custom GeoJSON Layer",
                "parameters": {
                    "opacity": 1.0,
                    "source": source_ids[4],
                    "symbologyState": single_symbol_state,
                },
                "type": "VectorLayer",
                "visible": True,
            },
            layer_ids[5]: {
                "name": "Custom GeoJSON Layer",
                "parameters": {
                    "opacity": 1.0,
                    "source": source_ids[5],
                    "symbologyState": graduated_state,
                },
                "type": "VectorLayer",
                "visible": True,
            },
            layer_ids[6]: {
                "name": "Custom GeoJSON Layer",
                "parameters": {
                    "opacity": 1.0,
                    "source": source_ids[6],
                    "symbologyState": categorized_state,
                },
                "type": "VectorLayer",
                "visible": True,
            },
        },
        "layerTree": [
            layer_ids[0],
            layer_ids[1],
            {
                "layers": [layer_ids[2], layer_ids[3]],
                "name": "group0",
                "visible": True,
            },
            layer_ids[4],
            layer_ids[5],
            layer_ids[6],
        ],
        "sources": {
            source_ids[0]: {
                "name": "OpenStreetMap0 Source",
                "type": "RasterSource",
                "parameters": {
                    "url": "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                    "maxZoom": 19,
                    "minZoom": 0,
                },
            },
            source_ids[1]: {
                "name": "OpenStreetMap1 Source",
                "type": "RasterSource",
                "parameters": {
                    "url": "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                    "maxZoom": 19,
                    "minZoom": 0,
                },
            },
            source_ids[2]: {
                "name": "Vector Tile Source",
                "type": "VectorTileSource",
                "parameters": {
                    "maxZoom": 13,
                    "minZoom": 0,
                    "url": "https://planetarycomputer.microsoft.com/api/data/v1/vector/collections/ms-buildings/tilesets/global-footprints/tiles/{z}/{x}/{y}",
                },
            },
            source_ids[3]: {
                "name": "OpenStreetMap3 Source",
                "type": "RasterSource",
                "parameters": {
                    "url": "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                    "maxZoom": 19,
                    "minZoom": 0,
                },
            },
            source_ids[4]: {
                "name": "Custom GeoJSON Layer Source",
                "parameters": {
                    "path": "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson",
                },
                "type": "GeoJSONSource",
            },
            source_ids[5]: {
                "name": "Custom GeoJSON Layer Source",
                "parameters": {
                    "path": "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson",
                },
                "type": "GeoJSONSource",
            },
            source_ids[6]: {
                "name": "Custom GeoJSON Layer Source",
                "parameters": {
                    "path": "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_roads.geojson",
                },
                "type": "GeoJSONSource",
            },
        },
        "metadata": {},
    }

    assert export_project_to_qgis(filename, jgis)

    imported = import_project_from_qgis(filename)

    # Non-symbology structure round-trips exactly (layer/source ids are stable
    # because export stores them on the QGIS layers and in the source map).
    imported_layers = imported["layers"]
    assert set(imported_layers) == set(layer_ids)
    for layer_id in layer_ids:
        assert imported_layers[layer_id]["name"] == jgis["layers"][layer_id]["name"]
        assert imported_layers[layer_id]["type"] == jgis["layers"][layer_id]["type"]
        assert (
            imported_layers[layer_id]["visible"] == jgis["layers"][layer_id]["visible"]
        )

    assert imported["sources"] == jgis["sources"]
    assert imported["layerTree"] == jgis["layerTree"]

    # Symbology is re-derived through QGIS, so we assert the Grammar shape rather
    # than byte-equality (rule UUIDs differ, alpha and ramp colours are lossy).

    # Single Symbol -> constant fill colour preserved (RGB; alpha is lossy).
    scheme, fields, params = _fill_mapping(
        imported_layers[layer_ids[4]]["parameters"]["symbologyState"],
    )
    assert scheme == "constant_rgba"
    assert fields is None
    assert [round(c) for c in params["value"][:3]] == [78, 164, 208]

    # Graduated -> colorRamp scale keyed on the original field.
    scheme, fields, _ = _fill_mapping(
        imported_layers[layer_ids[5]]["parameters"]["symbologyState"],
    )
    assert scheme == "colorRamp"
    assert fields == ["POP_RANK"]

    # Categorized line -> categorical scale on stroke-color keyed on the field.
    scheme, fields, _ = _fill_mapping(
        imported_layers[layer_ids[6]]["parameters"]["symbologyState"],
        channel="stroke-color",
    )
    assert scheme == "categorical"
    assert fields == ["min_label"]

    # Vector tile -> constant polygon fill colour preserved.
    scheme, _, params = _fill_mapping(
        imported_layers[layer_ids[2]]["parameters"]["symbologyState"],
    )
    assert scheme == "constant_rgba"
    assert [round(c) for c in params["value"][:3]] == [196, 60, 57]


def test_filters_to_subset():
    from ..grammar import filters_to_subset

    assert filters_to_subset(None) is None
    assert (
        filters_to_subset(
            {
                "logicalOp": "all",
                "appliedFilters": [{"operator": ">", "feature": "mag", "value": 5}],
            },
        )
        == '"mag" > 5'
    )
    assert (
        filters_to_subset(
            {
                "logicalOp": "any",
                "appliedFilters": [
                    {"operator": "==", "feature": "type", "value": "quake"},
                    {
                        "operator": "between",
                        "feature": "mag",
                        "betweenMin": 1,
                        "betweenMax": 5,
                    },
                ],
            },
        )
        == '("type" = \'quake\') OR ("mag" >= 1 AND "mag" <= 5)'
    )


def test_grammar_layer_subset():
    from ..grammar import grammar_layer_subset

    assert grammar_layer_subset({}) is None
    assert (
        grammar_layer_subset(
            {
                "when": [
                    {"type": "fieldCompare", "field": "mag", "op": ">", "value": 5.0},
                ],
                "whenOp": "all",
            },
        )
        == '"mag" > 5.0'
    )
    assert (
        grammar_layer_subset(
            {
                "when": [
                    {"type": "geometryType", "value": "Point"},
                    {"type": "hasField", "field": "x"},
                ],
                "whenOp": "any",
            },
        )
        == "(geometry_type($geometry) = 'Point') OR (\"x\" IS NOT NULL)"
    )


def test_qgis_multilayer_kde_roundtrip():
    filename = FILES / "project_multi.qgz"
    if os.path.exists(filename):
        os.remove(filename)

    lid, sid = str(uuid4()), str(uuid4())
    state = {
        "layers": [
            {
                "id": "points",
                "rules": [
                    {
                        "id": "r1",
                        "mappings": [
                            _constant_rgba(
                                [255.0, 0.0, 0.0, 1.0],
                                ["fill-color", "circle-fill-color"],
                            ),
                        ],
                    },
                ],
            },
            {
                "id": "heat",
                "preprocess": [
                    {"type": "kde", "radius": 3.0, "blur": 2.0, "weightField": "mag"},
                ],
                "rules": [
                    {
                        "id": "r2",
                        "fields": ["$density"],
                        "mappings": [
                            {
                                "scale": {
                                    "scheme": "colorRamp",
                                    "params": {
                                        "name": "viridis",
                                        "nShades": 9,
                                        "mode": "equal interval",
                                        "reverse": False,
                                        "fallback": [0, 0, 0, 0],
                                    },
                                },
                                "channels": ["pixel-rgb"],
                            },
                        ],
                    },
                ],
            },
        ],
    }
    jgis = {
        "options": {
            "projection": "EPSG:3857",
            "extent": [-2e7, -1e7, 2e7, 1e7],
            "useExtent": True,
        },
        "metadata": {},
        "layers": {
            lid: {
                "name": "Earthquakes",
                "type": "VectorLayer",
                "visible": True,
                "parameters": {"opacity": 1.0, "source": sid, "symbologyState": state},
            },
        },
        "sources": {
            sid: {
                "name": "src",
                "type": "GeoJSONSource",
                "parameters": {
                    "path": "https://raw.githubusercontent.com/nvkelso/"
                    "natural-earth-vector/master/geojson/"
                    "ne_110m_admin_0_countries.geojson",
                },
            },
        },
        "layerTree": [lid],
    }

    assert export_project_to_qgis(filename, jgis)
    imported = import_project_from_qgis(filename)

    # One jGIS layer with two grammar layers -> two QGIS layers (sharing the data
    # source) -> folded back into ONE jGIS layer with two renderings on import.
    vlayers = [
        layer for layer in imported["layers"].values() if layer["type"] == "VectorLayer"
    ]
    assert len(vlayers) == 1
    grammar_layers = vlayers[0]["parameters"]["symbologyState"]["layers"]
    assert len(grammar_layers) == 2

    # The single layer item appears once in the tree (no "::n" extra leaks).
    assert len(imported["layerTree"]) == 1

    # Exactly one rendering is a KDE heatmap (preprocess kde).
    kde_grammar_layers = [gl for gl in grammar_layers if gl.get("preprocess")]
    assert len(kde_grammar_layers) == 1
    grammar_layer = kde_grammar_layers[0]
    assert grammar_layer["preprocess"][0]["type"] == "kde"

    # The heatmap colour-ramp name survives the round-trip (the gradient bakes
    # colours and loses it; a fresh import would otherwise read back "custom").
    ramp = next(
        m["scale"]["params"]
        for r in grammar_layer["rules"]
        for m in r["mappings"]
        if "pixel-rgb" in m["channels"]
    )
    assert ramp["name"] == "viridis"


def test_qgis_scalar_size_and_heatmap_alpha():
    from qgis.core import (
        QgsHeatmapRenderer,
        QgsMarkerSymbol,
        QgsProject,
        QgsSingleSymbolRenderer,
    )

    filename = FILES / "project_eq.qgz"
    if os.path.exists(filename):
        os.remove(filename)

    lid, sid = str(uuid4()), str(uuid4())
    state = {
        "layers": [
            {
                "id": "points",
                "rules": [
                    {
                        "id": "r-fill",
                        "mappings": [
                            _constant_rgba(
                                [255.0, 0.0, 0.0, 0.45],
                                ["fill-color", "circle-fill-color"],
                            ),
                        ],
                    },
                    {
                        "id": "r-size",
                        "fields": ["mag"],
                        "mappings": [
                            {
                                "scale": {
                                    "scheme": "scalar",
                                    "params": {
                                        "domain": [3.0, 9.0],
                                        "range": [1.0, 10.0],
                                        "mode": "equal interval",
                                        "nStops": 5,
                                        "fallback": 0.0,
                                    },
                                },
                                "channels": ["circle-radius"],
                            },
                        ],
                    },
                ],
            },
            {
                "id": "heat",
                "preprocess": [
                    {"type": "kde", "radius": 3.0, "blur": 4.0, "weightField": "mag"},
                ],
                "when": [
                    {"type": "fieldCompare", "field": "mag", "op": ">", "value": 5.0},
                ],
                "rules": [
                    {
                        "id": "r-rgb",
                        "fields": ["$density"],
                        "mappings": [
                            {
                                "scale": {
                                    "scheme": "colorRamp",
                                    "params": {
                                        "name": "viridis",
                                        "nShades": 9,
                                        "mode": "equal interval",
                                        "reverse": False,
                                        "fallback": [0, 0, 0, 0],
                                    },
                                },
                                "channels": ["pixel-rgb"],
                            },
                        ],
                    },
                    {
                        "id": "r-alpha",
                        "mappings": [
                            {
                                "scale": {
                                    "scheme": "constant_num",
                                    "params": {"value": 0.9},
                                },
                                "channels": ["pixel-alpha"],
                            },
                        ],
                    },
                ],
            },
        ],
    }
    jgis = {
        "options": {
            "projection": "EPSG:3857",
            "extent": [-2e7, -1e7, 2e7, 1e7],
            "useExtent": True,
        },
        "metadata": {},
        "layers": {
            lid: {
                "name": "Earthquakes",
                "type": "VectorLayer",
                "visible": True,
                "parameters": {"opacity": 1.0, "source": sid, "symbologyState": state},
            },
        },
        "sources": {
            sid: {
                "name": "src",
                "type": "GeoJSONSource",
                "parameters": {"path": "https://example.invalid/points.geojson"},
            },
        },
        "layerTree": [lid],
    }

    logs = export_project_to_qgis(filename, jgis)
    assert logs["errors"] == []
    # Scalar radius is now translated (not approximated), so no warnings.
    assert logs["warnings"] == []

    project = QgsProject.instance()
    project.clear()
    project.read(str(filename))
    eq_layers = [
        layer for layer in project.mapLayers().values() if layer.name() == "Earthquakes"
    ]
    assert len(eq_layers) == 2

    # Points layer: a single symbol with the data-defined marker size carried on
    # the symbol (every vector layer is now a data-defined single symbol).
    point_layers = [
        layer
        for layer in eq_layers
        if isinstance(layer.renderer(), QgsSingleSymbolRenderer)
        and isinstance(layer.renderer().symbol(), QgsMarkerSymbol)
    ]
    assert len(point_layers) == 1
    symbol = point_layers[0].renderer().symbol()
    dd = symbol.dataDefinedSize()
    assert dd.isActive()
    assert "scale_linear" in dd.asExpression()

    # Heatmap layer: pixel-alpha folded into opacity, when -> subset string.
    heat_layers = [
        layer for layer in eq_layers if isinstance(layer.renderer(), QgsHeatmapRenderer)
    ]
    assert len(heat_layers) == 1
    assert abs(heat_layers[0].opacity() - 0.9) < 1e-6
    assert "mag" in heat_layers[0].subsetString()


def test_qgis_filter_roundtrip():
    from ..grammar import subset_to_when

    # Pure-function inverse of the subset strings we emit.
    assert subset_to_when("\"continent\" = 'Asia'") == [
        {"type": "fieldEquals", "field": "continent", "value": "Asia"},
    ]
    assert subset_to_when('"mag" > 5') == [
        {"type": "fieldCompare", "field": "mag", "op": ">", "value": 5},
    ]
    assert subset_to_when("") is None
    # Complex expressions are not parsed (filter dropped, path still valid).
    assert subset_to_when('("a" = 1) OR ("b" = 2)') is None

    # End-to-end: a layer-level `when` survives export -> import, and the source
    # path is clean (no "|subset=" glued on).
    filename = FILES / "project_filter.qgz"
    if os.path.exists(filename):
        os.remove(filename)

    lid, sid = str(uuid4()), str(uuid4())
    state = {
        "layers": [
            {
                "id": "L",
                "when": [
                    {"type": "fieldEquals", "field": "continent", "value": "Asia"},
                ],
                "rules": [
                    {
                        "id": "r",
                        "mappings": [
                            _constant_rgba(
                                [1.0, 2.0, 3.0, 1.0],
                                ["fill-color", "circle-fill-color"],
                            ),
                        ],
                    },
                ],
            },
        ],
    }
    path = (
        "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/"
        "master/geojson/ne_10m_roads.geojson"
    )
    jgis = {
        "options": {
            "projection": "EPSG:3857",
            "extent": [-2e7, -1e7, 2e7, 1e7],
            "useExtent": True,
        },
        "metadata": {},
        "layers": {
            lid: {
                "name": "Roads",
                "type": "VectorLayer",
                "visible": True,
                "parameters": {"opacity": 1.0, "source": sid, "symbologyState": state},
            },
        },
        "sources": {
            sid: {"name": "src", "type": "GeoJSONSource", "parameters": {"path": path}},
        },
        "layerTree": [lid],
    }

    assert export_project_to_qgis(filename, jgis)
    imported = import_project_from_qgis(filename)

    vlayer = next(
        layer for layer in imported["layers"].values() if layer["type"] == "VectorLayer"
    )
    imported_path = imported["sources"][vlayer["parameters"]["source"]]["parameters"][
        "path"
    ]
    assert imported_path == path  # no "|subset=" appended
    grammar_layer = vlayer["parameters"]["symbologyState"]["layers"][0]
    assert grammar_layer["when"] == [
        {"type": "fieldEquals", "field": "continent", "value": "Asia"},
    ]


def _vector_tile_jgis(lid, sid, fill_rgba):
    state = {
        "layers": [
            {
                "id": "vt-0",
                "rules": [
                    {
                        "id": "r0",
                        "mappings": [
                            _constant_rgba(fill_rgba, ["fill-color"]),
                            _constant_rgba([0.0, 255.0, 0.0, 1.0], ["stroke-color"]),
                            _constant_rgba(
                                [0.0, 0.0, 255.0, 1.0],
                                ["circle-fill-color"],
                            ),
                        ],
                    },
                ],
            },
        ],
    }
    return {
        "options": {
            "projection": "EPSG:3857",
            "extent": [-2e7, -1e7, 2e7, 1e7],
            "useExtent": True,
        },
        "metadata": {},
        "layers": {
            lid: {
                "name": "Tiles",
                "type": "VectorTileLayer",
                "visible": True,
                "parameters": {"opacity": 1.0, "source": sid, "symbologyState": state},
            },
        },
        "sources": {
            sid: {
                "name": "src",
                "type": "VectorTileSource",
                "parameters": {
                    "url": "https://example.com/tiles/{z}/{x}/{y}.pbf",
                    "minZoom": 0,
                    "maxZoom": 14,
                },
            },
        },
        "layerTree": [lid],
    }


def test_qgis_vector_tile_roundtrip():
    """Edited vector-tile colours must survive export -> reopen (PR #1482 bug).

    Exports twice over the same file (the "save again" path): the second save
    must win. The bug was that overwriting kept the first save's symbology.
    """
    from ..grammar import grammar_to_flat_colors

    filename = FILES / "project_vt.qgz"
    if os.path.exists(filename):
        os.remove(filename)

    lid, sid = str(uuid4()), str(uuid4())
    # First save (red), then overwrite with the edited colour (green).
    assert export_project_to_qgis(
        filename,
        _vector_tile_jgis(lid, sid, [255.0, 0, 0, 1]),
    )
    assert export_project_to_qgis(
        filename,
        _vector_tile_jgis(lid, sid, [0, 255.0, 0, 1]),
    )
    imported = import_project_from_qgis(filename)

    vt = next(
        layer
        for layer in imported["layers"].values()
        if layer["type"] == "VectorTileLayer"
    )
    colors = grammar_to_flat_colors(vt["parameters"]["symbologyState"])

    # The second save must win, not the stale first one.
    assert colors["fill-color"][:3] == [0.0, 255.0, 0.0]
    assert colors["stroke-color"][:3] == [0.0, 255.0, 0.0]
    assert colors["circle-fill-color"][:3] == [0.0, 0.0, 255.0]


def test_vector_tile_colorramp_to_class_styles():
    """A vector-tile colorRamp -> one constant-colour style per class.

    Data-defined symbol colours do not load across QGIS versions, so a ramp must
    export as value-filtered constant-colour classes (which render everywhere).
    The Polygon ramp fills and outlines each class; the LineString stays constant.
    """
    from ..grammar import grammar_to_vector_tile_styles

    symbology_state = {
        "layers": [
            {
                "id": "poly",
                "when": [{"type": "geometryType", "value": "Polygon"}],
                "rules": [
                    {
                        "id": "r",
                        "fields": ["best_age_top"],
                        "mappings": [
                            {
                                "channels": ["fill-color", "stroke-color"],
                                "scale": {
                                    "scheme": "colorRamp",
                                    "params": {
                                        "name": "viridis",
                                        "colorStops": [
                                            {
                                                "stop": 1.0,
                                                "color": [68.0, 1.0, 84.0, 1.0],
                                            },
                                            {
                                                "stop": 100.0,
                                                "color": [59.0, 81.0, 139.0, 1.0],
                                            },
                                            {
                                                "stop": 3600.0,
                                                "color": [253.0, 231.0, 37.0, 1.0],
                                            },
                                        ],
                                    },
                                },
                            },
                        ],
                    },
                ],
            },
            {
                "id": "line",
                "when": [{"type": "geometryType", "value": "LineString"}],
                "rules": [
                    {
                        "id": "r2",
                        "mappings": [
                            _constant_rgba([0.0, 0.0, 0.0, 0.72], ["stroke-color"]),
                        ],
                    },
                ],
            },
        ],
    }
    logs = {"warnings": [], "errors": []}
    specs = grammar_to_vector_tile_styles(symbology_state, logs, "L")

    poly = [s for s in specs if s["geom"] == 2]
    # Three stops -> three Polygon classes, each a constant colour with a filter.
    assert len(poly) == 3
    assert all("best_age_top" in s["filter"] for s in poly)
    assert poly[0]["fill"] == [68.0, 1.0, 84.0, 1.0]
    assert poly[0]["stroke"] == [68.0, 1.0, 84.0, 1.0]
    assert poly[-1]["fill"] == [253.0, 231.0, 37.0, 1.0]

    # LineString: one unfiltered constant stroke; no Point styles; no warnings.
    line = [s for s in specs if s["geom"] == 1]
    assert line == [
        {"geom": 1, "filter": None, "fill": None, "stroke": [0.0, 0.0, 0.0, 0.72]},
    ]
    assert not [s for s in specs if s["geom"] == 0]
    assert logs["warnings"] == []


def _channel_band_sig(grammar):
    """Map each pixel channel to its (band-field, scale-scheme), ignoring ids."""
    sig = {}
    for rule in grammar["layers"][0]["rules"]:
        mapping = rule["mappings"][0]
        sig[mapping["channels"][0]] = (rule["fields"][0], mapping["scale"]["scheme"])
    return sig


def test_multiband_raster_roundtrip():
    """Multiband RGB rasters export to QgsMultiBandColorRenderer and back.

    Single-band pseudocolor can't carry an R/G/B mapping; before this the
    exporter wrote no renderer (reload showed the default) and the importer
    crashed calling .shader() on a multiband renderer (PR #1482).
    """
    from qgis.core import QgsMultiBandColorRenderer, QgsRasterLayer

    from ..grammar import grammar_to_raster_renderer, multiband_raster_to_grammar

    tif = FILES / "_mb.tif"
    _make_rgb_tif(tif)
    try:
        layer = QgsRasterLayer(str(tif), "mb", "gdal")
        assert layer.isValid()
        logs = {"warnings": [], "errors": []}

        # Export: R<-band3, G<-band2, B<-band1, with a contrast stretch on red.
        grammar_in = multiband_raster_to_grammar({0: 3, 1: 2, 2: 1}, {0: (0.0, 100.0)})
        renderer, _vmin, _vmax = grammar_to_raster_renderer(
            grammar_in,
            layer.dataProvider(),
            logs,
            "lid",
        )
        assert isinstance(renderer, QgsMultiBandColorRenderer)
        assert (renderer.redBand(), renderer.greenBand(), renderer.blueBand()) == (
            3,
            2,
            1,
        )
        ce = renderer.redContrastEnhancement()
        assert ce is not None
        assert (ce.minimumValue(), ce.maximumValue()) == (0.0, 100.0)
        assert logs["warnings"] == []

        # Import: renderer -> grammar (mirrors qgis_layer_to_jgis multiband branch).
        bands = {
            0: renderer.redBand(),
            1: renderer.greenBand(),
            2: renderer.blueBand(),
        }
        ranges = {0: (ce.minimumValue(), ce.maximumValue())}
        grammar_out = multiband_raster_to_grammar(bands, ranges)

        assert _channel_band_sig(grammar_out) == _channel_band_sig(grammar_in)
    finally:
        if os.path.exists(tif):
            os.remove(tif)


def test_multiband_alpha_band_roundtrip():
    """A dedicated pixel-alpha band becomes the QGIS renderer's alpha band.

    Without this the alpha/mask band was dropped, so masked (nodata) pixels
    rendered opaque black in QGIS instead of transparent.
    """
    from osgeo import gdal
    from qgis.core import QgsMultiBandColorRenderer, QgsRasterLayer

    from ..grammar import grammar_to_raster_renderer, multiband_raster_to_grammar

    tif = FILES / "_rgba.tif"
    ds = gdal.GetDriverByName("GTiff").Create(str(tif), 4, 4, 4, gdal.GDT_Byte)
    for band in range(1, 5):
        ds.GetRasterBand(band).Fill(band * 10)
    ds.FlushCache()
    ds = None
    try:
        layer = QgsRasterLayer(str(tif), "rgba", "gdal")
        assert layer.isValid()
        logs = {"warnings": [], "errors": []}

        # R/G/B <- bands 1/2/3, alpha <- band 4.
        grammar_in = multiband_raster_to_grammar({0: 1, 1: 2, 2: 3}, alpha_band=4)
        renderer, _vmin, _vmax = grammar_to_raster_renderer(
            grammar_in,
            layer.dataProvider(),
            logs,
            "lid",
        )
        assert isinstance(renderer, QgsMultiBandColorRenderer)
        assert renderer.alphaBand() == 4
        # The dropped-alpha warning must not fire for a dedicated alpha band.
        assert logs["warnings"] == []

        # Import: renderer -> grammar keeps the pixel-alpha band.
        bands = {
            0: renderer.redBand(),
            1: renderer.greenBand(),
            2: renderer.blueBand(),
        }
        grammar_out = multiband_raster_to_grammar(
            bands,
            alpha_band=renderer.alphaBand(),
        )
        assert _channel_band_sig(grammar_out)["pixel-alpha"] == ("$band-4", "identity")
    finally:
        if os.path.exists(tif):
            os.remove(tif)


def test_single_band_gray_import_has_min_max():
    """Single-band rasters get numeric min/max + a displayable grayscale grammar.

    A single-band float GeoTIFF (e.g. ESA biomass) loads with a gray renderer;
    before this it fell through to empty symbology with no min/max, so the source
    failed validation (".urls.0.min must be number") and didn't render.
    """
    from qgis.core import QgsRasterLayer, QgsSingleBandGrayRenderer

    from ..grammar import grayscale_raster_to_grammar
    from ..qgis_loader import _raster_min_max

    tif = FILES / "_gray.tif"
    _make_gray_tif(tif)
    try:
        layer = QgsRasterLayer(str(tif), "g", "gdal")
        assert layer.isValid()
        renderer = layer.renderer()
        assert isinstance(renderer, QgsSingleBandGrayRenderer)

        vmin, vmax = _raster_min_max(
            layer.dataProvider(),
            renderer.grayBand(),
            renderer.contrastEnhancement(),
        )
        # Numeric, finite, non-degenerate — satisfies the GeoTiff source schema.
        assert isinstance(vmin, float)
        assert isinstance(vmax, float)
        assert vmin < vmax

        grammar = grayscale_raster_to_grammar(renderer.grayBand())
        mapping = grammar["layers"][0]["rules"][0]["mappings"][0]
        assert mapping["channels"] == ["pixel-color"]
        assert mapping["scale"]["scheme"] == "colorRamp"
        # Stops/domain are normalized [0, 1] (JupyterGIS renders normalized bands);
        # raw [vmin, vmax] stops would collapse the data to one colour ("1 pixel").
        assert mapping["scale"]["params"]["domain"] == [0.0, 1.0]
        stops = [s["stop"] for s in mapping["scale"]["params"]["colorStops"]]
        assert stops == [0.0, 1.0]
    finally:
        if os.path.exists(tif):
            os.remove(tif)


def test_raster_colorramp_value_space_roundtrip():
    """Grammar colorRamp stops stay normalized [0,1]; QGIS gets raw band values.

    The source min/max scale between the two spaces so the ramp spans the data
    instead of collapsing to one colour.
    """
    from qgis.core import QgsSingleBandPseudoColorRenderer

    from ..grammar import grammar_to_raster_renderer, raster_to_grammar

    tif = FILES / "_gray.tif"
    _make_gray_tif(tif)
    try:
        from qgis.core import QgsRasterLayer

        layer = QgsRasterLayer(str(tif), "g", "gdal")
        logs = {"warnings": [], "errors": []}

        # A normalized grammar (stops 0..1) over a raw source range [0, 200].
        grammar = {
            "layers": [
                {
                    "id": "l",
                    "rules": [
                        {
                            "id": "r",
                            "fields": ["$band-1"],
                            "mappings": [
                                {
                                    "scale": {
                                        "scheme": "colorRamp",
                                        "params": {
                                            "domain": [0.0, 1.0],
                                            "colorStops": [
                                                {"stop": 0.0, "color": [0, 0, 0, 1]},
                                                {
                                                    "stop": 1.0,
                                                    "color": [255, 255, 255, 1],
                                                },
                                            ],
                                        },
                                    },
                                    "channels": ["pixel-color"],
                                },
                            ],
                        },
                    ],
                },
            ],
        }
        renderer, vmin, vmax = grammar_to_raster_renderer(
            grammar,
            layer.dataProvider(),
            logs,
            "lid",
            0.0,
            200.0,
        )
        assert isinstance(renderer, QgsSingleBandPseudoColorRenderer)
        # The [0, 1] stops are scaled to the raw [0, 200] band range for QGIS.
        assert (vmin, vmax) == (0.0, 200.0)
        items = renderer.shader().rasterShaderFunction().colorRampItemList()
        assert [round(i.value, 3) for i in items] == [0.0, 200.0]

        # Importing those raw QGIS items normalizes them back to [0, 1].
        regrammar = raster_to_grammar(items, 1, 0.0, 200.0)
        stops = regrammar["layers"][0]["rules"][0]["mappings"][0]["scale"]["params"][
            "colorStops"
        ]
        assert [s["stop"] for s in stops] == [0.0, 1.0]
    finally:
        if os.path.exists(tif):
            os.remove(tif)


def test_raster_flat_color_to_grammar_migrates_legacy_ramp():
    """A legacy OL `color` interpolate expression folds into a pixel-color ramp.

    Pre-Grammar GeoTiff layers stored their ramp in `parameters.color` rather
    than `symbologyState.layers`; the exporter must migrate it (including the
    transparent value-0 stop that makes nodata transparent) instead of dropping
    it and falling back to QGIS's default grayscale renderer.
    """
    from ..grammar import raster_flat_color_to_grammar

    color = [
        "interpolate",
        ["linear"],
        ["band", 1.0],
        0.0,
        [0.0, 0.0, 0.0, 0.0],
        0.0,
        [68.0, 1.0, 84.0, 1.0],
        0.5,
        [33.0, 144.0, 141.0, 1.0],
        1.0,
        [253.0, 231.0, 37.0, 1.0],
    ]
    grammar = raster_flat_color_to_grammar(color)

    rule = grammar["layers"][0]["rules"][0]
    assert rule["fields"] == ["$band-1"]
    mapping = rule["mappings"][0]
    assert mapping["channels"] == ["pixel-color"]
    assert mapping["scale"]["scheme"] == "colorRamp"
    stops = mapping["scale"]["params"]["colorStops"]
    # Stops (already normalized [0, 1]) pass straight through, transparent 0 kept.
    assert [s["stop"] for s in stops] == [0.0, 0.0, 0.5, 1.0]
    assert stops[0]["color"] == [0.0, 0.0, 0.0, 0.0]
    assert stops[-1]["color"] == [253.0, 231.0, 37.0, 1.0]

    # Non-interpolate / malformed input yields an empty symbology state.
    assert raster_flat_color_to_grammar(None) == {"layers": []}
    assert raster_flat_color_to_grammar(["foo"]) == {"layers": []}


def _roundtrip_layer(grammar_layer, geometry_type):
    """Grammar layer -> data-defined QGIS symbol -> grammar."""
    from qgis.core import QgsPointClusterRenderer, QgsSingleSymbolRenderer

    from ..data_defined import grammar_layer_to_renderer
    from ..qgis_loader import _vector_renderer_to_grammar

    logs = {"warnings": [], "errors": []}
    renderer = grammar_layer_to_renderer(
        grammar_layer,
        geometry_type,
        1.0,
        None,
        logs,
        "L",
    )
    # Vector layers are now a single symbol with data-defined channels (cluster
    # layers wrap it in a point-cluster renderer).
    assert isinstance(
        renderer,
        (QgsSingleSymbolRenderer, QgsPointClusterRenderer),
    )
    state = _vector_renderer_to_grammar(renderer)
    return state["layers"][0], logs


def _mapping_for_channel(grammar_layer, channel):
    """(scheme, params, fields, when) of the mapping driving ``channel``."""
    for rule in grammar_layer.get("rules", []):
        for mapping in rule.get("mappings", []):
            if channel in mapping.get("channels", []):
                scale = mapping["scale"]
                return (
                    scale["scheme"],
                    scale.get("params", {}),
                    rule.get("fields"),
                    rule.get("when"),
                )
    return None, None, None, None


def test_graduated_roundtrip():
    """ColorRamp fill with materialized stops -> native graduated -> colorRamp.

    Graduated layers export as a native QgsGraduatedSymbolRenderer (not rule-based)
    so the exact class breaks survive the round-trip on all QGIS versions.
    """
    layer = _grammar(
        [
            {
                "id": "r",
                "fields": ["pop"],
                "mappings": [
                    {
                        "scale": {
                            "scheme": "colorRamp",
                            "params": {
                                "name": "viridis",
                                "nShades": 2,
                                "mode": "equal interval",
                                "reverse": False,
                                "fallback": [0, 0, 0, 0],
                                "colorStops": [
                                    {"stop": 0.0, "color": [255, 0, 0, 1.0]},
                                    {"stop": 5.0, "color": [0, 255, 0, 1.0]},
                                    {"stop": 10.0, "color": [0, 0, 255, 1.0]},
                                ],
                            },
                        },
                        "channels": ["fill-color", "circle-fill-color"],
                    },
                ],
            },
        ],
    )["layers"][0]
    out, logs = _roundtrip_layer(layer, "fill")
    scheme, params, fields, _ = _mapping_for_channel(out, "fill-color")
    assert scheme == "colorRamp"
    assert fields == ["pop"]
    assert [s["stop"] for s in params["colorStops"]] == [0.0, 5.0, 10.0]
    assert logs["warnings"] == []


def test_categorized_roundtrip_rule_based():
    """Categorical fill with materialized stops -> rule-based -> categorical."""
    layer = _grammar(
        [
            {
                "id": "r",
                "fields": ["continent"],
                "mappings": [
                    {
                        "scale": {
                            "scheme": "categorical",
                            "params": {
                                "colorRamp": "viridis",
                                "reverse": False,
                                "fallback": [0, 0, 0, 0],
                                "colorStops": [
                                    {"stop": "Asia", "color": [255, 0, 0, 1.0]},
                                    {"stop": "Europe", "color": [0, 0, 255, 1.0]},
                                ],
                            },
                        },
                        "channels": ["fill-color", "circle-fill-color"],
                    },
                ],
            },
        ],
    )["layers"][0]
    out, _ = _roundtrip_layer(layer, "fill")
    scheme, params, fields, _ = _mapping_for_channel(out, "fill-color")
    assert scheme == "categorical"
    assert fields == ["continent"]
    stops = {
        s["stop"]: [round(c) for c in s["color"][:3]] for s in params["colorStops"]
    }
    assert stops == {"Asia": [255, 0, 0], "Europe": [0, 0, 255]}


def test_line_categorical_stroke_color_roundtrip():
    """A line coloured categorically by a field (e.g. roads by type) round-trips
    as a categorical scale on stroke-color, not fill-color (a line has no fill).

    A data-driven stroke width on a *different* field (length_km) round-trips as
    a scalar mapping in its own rule, not flattened to a constant.
    """
    layer = _grammar(
        [
            {
                "id": "r-color",
                "fields": ["type"],
                "mappings": [
                    {
                        "scale": {
                            "scheme": "categorical",
                            "params": {
                                "colorRamp": "schemePaired",
                                "reverse": False,
                                "fallback": [0, 0, 0, 0],
                                "colorStops": [
                                    {"stop": "Road", "color": [227, 26, 28, 1.0]},
                                    {"stop": "Track", "color": [255, 127, 0, 1.0]},
                                ],
                            },
                        },
                        "channels": ["stroke-color"],
                    },
                ],
            },
            {
                "id": "r-width",
                "fields": ["length_km"],
                "mappings": [
                    {
                        "scale": {
                            "scheme": "scalar",
                            "params": {
                                "domain": [0.0, 100.0],
                                "range": [1.0, 5.0],
                                "mode": "equal interval",
                                "nStops": 5,
                                "fallback": 1.0,
                            },
                        },
                        "channels": ["stroke-width"],
                    },
                ],
            },
        ],
    )["layers"][0]
    out, logs = _roundtrip_layer(layer, "line")
    scheme, params, fields, _ = _mapping_for_channel(out, "stroke-color")
    assert scheme == "categorical"
    assert fields == ["type"]
    stops = {
        s["stop"]: [round(c) for c in s["color"][:3]] for s in params["colorStops"]
    }
    assert stops == {"Road": [227, 26, 28], "Track": [255, 127, 0]}
    # A line has no fill, so the colour must not land on fill-color.
    assert _mapping_for_channel(out, "fill-color")[0] is None
    # The data-driven width survives as a scalar on its own field.
    w_scheme, w_params, w_fields, _ = _mapping_for_channel(out, "stroke-width")
    assert w_scheme == "scalar"
    assert w_fields == ["length_km"]
    assert w_params["domain"] == [0.0, 100.0]
    assert w_params["range"] == [1.0, 5.0]
    assert logs["warnings"] == []


def test_scalar_size_roundtrip():
    """A data-driven circle radius round-trips as a scalar scale (no warnings)."""
    layer = {
        "id": "x",
        "rules": [
            {
                "id": "r-fill",
                "mappings": [_constant_rgba([255, 0, 0, 1.0], ["circle-fill-color"])],
            },
            {
                "id": "r-size",
                "fields": ["mag"],
                "mappings": [
                    {
                        "scale": {
                            "scheme": "scalar",
                            "params": {
                                "domain": [3.0, 9.0],
                                "range": [1.0, 10.0],
                                "mode": "equal interval",
                                "nStops": 5,
                                "fallback": 0.0,
                            },
                        },
                        "channels": ["circle-radius"],
                    },
                ],
            },
        ],
    }
    out, logs = _roundtrip_layer(layer, "circle")
    scheme, params, fields, _ = _mapping_for_channel(out, "circle-radius")
    assert scheme == "scalar"
    assert fields == ["mag"]
    assert params["domain"] == [3.0, 9.0]
    assert params["range"] == [1.0, 10.0]
    assert logs["warnings"] == []


def test_identity_stroke_roundtrip():
    """A data-driven (identity) stroke colour round-trips as an identity scale."""
    layer = {
        "id": "x",
        "rules": [
            {
                "id": "r-fill",
                "mappings": [_constant_rgba([255, 0, 0, 1.0], ["fill-color"])],
            },
            {
                "id": "r-stroke",
                "fields": ["colour"],
                "mappings": [
                    {"scale": {"scheme": "identity"}, "channels": ["stroke-color"]},
                ],
            },
        ],
    }
    out, logs = _roundtrip_layer(layer, "fill")
    scheme, _, fields, _ = _mapping_for_channel(out, "stroke-color")
    assert scheme == "identity"
    assert fields == ["colour"]
    assert logs["warnings"] == []


def test_rule_when_roundtrip():
    """A rule-level `when` round-trips as a guarded grammar rule (predicate kept)."""
    layer = {
        "id": "x",
        "rules": [
            {
                "id": "base",
                "mappings": [_constant_rgba([200, 200, 200, 1.0], ["fill-color"])],
            },
            {
                "id": "guard",
                "when": [
                    {"type": "fieldCompare", "field": "mag", "op": ">", "value": 5},
                ],
                "mappings": [_constant_rgba([255, 0, 0, 1.0], ["fill-color"])],
            },
        ],
    }
    out, _ = _roundtrip_layer(layer, "fill")
    guarded = [rule for rule in out["rules"] if rule.get("when")]
    assert len(guarded) == 1
    assert guarded[0]["when"] == [
        {"type": "fieldCompare", "field": "mag", "op": ">", "value": 5.0},
    ]
    # The guarded rule keeps its constant fill colour.
    fill = next(m for m in guarded[0]["mappings"] if "fill-color" in m["channels"])
    assert [round(c) for c in fill["scale"]["params"]["value"][:3]] == [255, 0, 0]


def test_line_colorramp_mixed_channels_roundtrip():
    """A line coloured by a colorRamp tagged on BOTH stroke-color and
    circle-fill-color (as the frontend emits) must export the ramp on the line's
    stroke — not get mis-filed as a fill scale and lost, which rendered black.
    """
    layer = _grammar(
        [
            {
                "id": "r",
                "fields": ["length_km"],
                "mappings": [
                    {
                        "channels": ["stroke-color", "circle-fill-color"],
                        "scale": {
                            "scheme": "colorRamp",
                            "params": {
                                "name": "viridis",
                                "nShades": 2,
                                "mode": "equal interval",
                                "reverse": False,
                                "fallback": [0, 0, 0, 0],
                                "colorStops": [
                                    {"stop": 0.0, "color": [68, 1, 84, 1.0]},
                                    {"stop": 100.0, "color": [253, 231, 37, 1.0]},
                                ],
                            },
                        },
                    },
                ],
            },
        ],
    )["layers"][0]
    out, logs = _roundtrip_layer(layer, "line")
    scheme, _params, fields, _when = _mapping_for_channel(out, "stroke-color")
    assert scheme == "colorRamp"
    assert fields == ["length_km"]
    # The line has no fill, so the ramp must NOT have landed on fill-color.
    assert _mapping_for_channel(out, "fill-color")[0] is None
    assert logs["warnings"] == []


def test_roads_when_colorramp_and_constant_roundtrip(tmp_path):
    """roads.jGIS shape: two grammar layers on one line source, each with a
    layer-level ``when`` — Asia coloured by a colorRamp on length_km, Africa a
    constant colour. The Asia ramp is tagged stroke-color + circle-fill-color; on a
    line it must export as a data-driven stroke colour (not black) and round-trip
    back with its ``when`` and scheme intact.
    """
    import json

    gj = tmp_path / "roads_line.geojson"
    feats = [
        {
            "type": "Feature",
            "properties": {"continent": c, "length_km": lk},
            "geometry": {"type": "LineString", "coordinates": [[0, i], [3, i]]},
        }
        for i, (c, lk) in enumerate([("Asia", 50), ("Asia", 800), ("Africa", 120)])
    ]
    gj.write_text(json.dumps({"type": "FeatureCollection", "features": feats}))

    asia = {
        "id": "L-asia",
        "when": [{"type": "fieldEquals", "field": "continent", "value": "Asia"}],
        "rules": [
            {
                "id": "r",
                "fields": ["length_km"],
                "mappings": [
                    {
                        "channels": ["stroke-color", "circle-fill-color"],
                        "scale": {
                            "scheme": "colorRamp",
                            "params": {
                                "name": "viridis",
                                "domain": [0.0, 1583.0],
                                "nShades": 3,
                                "mode": "quantile",
                                "reverse": False,
                                "fallback": [0, 0, 0, 0],
                                "colorStops": [
                                    {"stop": 0.0, "color": [68, 1, 84, 1.0]},
                                    {"stop": 117.7, "color": [59, 81, 139, 1.0]},
                                    {"stop": 1583.0, "color": [253, 231, 37, 1.0]},
                                ],
                            },
                        },
                    },
                ],
            },
        ],
    }
    africa = {
        "id": "L-africa",
        "when": [{"type": "fieldEquals", "field": "continent", "value": "Africa"}],
        "rules": [
            {
                "id": "r",
                "mappings": [
                    {
                        "channels": ["stroke-color"],
                        "scale": {
                            "scheme": "constant_rgba",
                            "params": {"value": [0, 255, 0, 1.0]},
                        },
                    },
                ],
            },
        ],
    }
    lid = "11111111-2222-3333-4444-555555555555"
    jgis = {
        "options": {"projection": "EPSG:4326"},
        "layers": {
            lid: {
                "name": "Roads",
                "type": "VectorLayer",
                "visible": True,
                "parameters": {
                    "opacity": 1.0,
                    "source": "s",
                    "symbologyState": {"layers": [asia, africa]},
                },
            },
        },
        "sources": {
            "s": {
                "name": "s",
                "type": "GeoJSONSource",
                "parameters": {"path": str(gj)},
            },
        },
        "layerTree": [lid],
    }

    out = tmp_path / "roads_out.qgz"
    logs = export_project_to_qgis(str(out), jgis)
    assert logs["errors"] == []
    # The colorRamp on the line must translate; a dropped ramp warns + renders black.
    assert not any("could not be translated" in w for w in logs["warnings"])

    reimported = import_project_from_qgis(str(out))
    # Each grammar layer round-trips to its own jGIS layer (N layers -> N layers).
    by_continent = {}
    for layer in reimported["layers"].values():
        state = layer["parameters"]["symbologyState"]
        for grammar_layer in state.get("layers", []):
            when = grammar_layer.get("when") or []
            if when:
                by_continent[when[0]["value"]] = grammar_layer
    assert set(by_continent) == {"Asia", "Africa"}

    # Asia: data-driven colorRamp on the line's stroke-color, keyed on length_km.
    scheme, _params, fields, _when = _mapping_for_channel(
        by_continent["Asia"],
        "stroke-color",
    )
    assert scheme == "colorRamp"
    assert fields == ["length_km"]
    # Africa: constant green stroke colour preserved.
    a_scheme, a_params, _f, _w = _mapping_for_channel(
        by_continent["Africa"],
        "stroke-color",
    )
    assert a_scheme == "constant_rgba"
    assert [round(c) for c in a_params["value"][:3]] == [0, 255, 0]


def test_polygon_categorical_outline_roundtrip():
    """A polygon whose OUTLINE (stroke-color) is data-driven by a categorical scale
    must export that outline as its own data-defined stroke colour and round-trip.

    Before the colour-slot rewrite the outline was not a slot of its own: a secondary
    data-driven colour was collected but never applied, so the outline silently fell
    back to a flat default. The fill stays an independent constant.
    """
    layer = _grammar(
        [
            {
                "id": "r-outline",
                "fields": ["continent"],
                "mappings": [
                    {
                        "scale": {
                            "scheme": "categorical",
                            "params": {
                                "colorRamp": "viridis",
                                "reverse": False,
                                "fallback": [0, 0, 0, 0],
                                "colorStops": [
                                    {"stop": "Asia", "color": [255, 0, 0, 1.0]},
                                    {"stop": "Europe", "color": [0, 0, 255, 1.0]},
                                ],
                            },
                        },
                        "channels": ["stroke-color"],
                    },
                ],
            },
            {
                "id": "r-fill",
                "mappings": [
                    {
                        "scale": {
                            "scheme": "constant_rgba",
                            "params": {"value": [200, 200, 200, 1.0]},
                        },
                        "channels": ["fill-color", "circle-fill-color"],
                    },
                ],
            },
        ],
    )["layers"][0]
    out, logs = _roundtrip_layer(layer, "fill")
    # Outline: categorical stroke colour preserved (was dropped before the rewrite).
    scheme, params, fields, _ = _mapping_for_channel(out, "stroke-color")
    assert scheme == "categorical"
    assert fields == ["continent"]
    stops = {
        s["stop"]: [round(c) for c in s["color"][:3]] for s in params["colorStops"]
    }
    assert stops == {"Asia": [255, 0, 0], "Europe": [0, 0, 255]}
    # Fill stays an independent plain constant grey.
    f_scheme, f_params, _f, _w = _mapping_for_channel(out, "fill-color")
    assert f_scheme == "constant_rgba"
    assert [round(c) for c in f_params["value"][:3]] == [200, 200, 200]
    assert logs["warnings"] == []


def test_line_color_via_circle_fill_only_roundtrip():
    """A line whose only colour mapping is tagged on circle-fill-color (not
    stroke-color) must still colour the line's stroke.

    Geometry-aware routing sends a line's sole colour to its stroke slot instead of
    filing it as a fill (a line has no fill), which previously left the line black.
    """
    layer = _grammar(
        [
            {
                "id": "r",
                "fields": ["type"],
                "mappings": [
                    {
                        "scale": {
                            "scheme": "categorical",
                            "params": {
                                "colorRamp": "viridis",
                                "reverse": False,
                                "fallback": [0, 0, 0, 0],
                                "colorStops": [
                                    {"stop": "Road", "color": [227, 26, 28, 1.0]},
                                    {"stop": "Track", "color": [255, 127, 0, 1.0]},
                                ],
                            },
                        },
                        "channels": ["circle-fill-color"],
                    },
                ],
            },
        ],
    )["layers"][0]
    out, logs = _roundtrip_layer(layer, "line")
    # The sole colour mapping lands on the line's stroke, not dropped to black.
    scheme, _params, fields, _ = _mapping_for_channel(out, "stroke-color")
    assert scheme == "categorical"
    assert fields == ["type"]
    # A line has no fill, so the colour must NOT have landed on fill-color.
    assert _mapping_for_channel(out, "fill-color")[0] is None
    assert logs["warnings"] == []


def test_colorramp_name_survives_reopen(tmp_path):
    """The selected colour ramp (its name + direction) must survive a .qgz reopen.

    Export bakes a colorRamp into concrete colour stops, which loses which named
    ramp was picked; the name is stashed on the layer's custom property so import
    restores the picker selection instead of defaulting to viridis.
    """
    import json

    gj = tmp_path / "regions.geojson"
    feats = [
        {
            "type": "Feature",
            "properties": {"pop": pop},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[0, i], [1, i], [1, i + 1], [0, i], [0, i]]],
            },
        }
        for i, pop in enumerate([10, 500, 5000])
    ]
    gj.write_text(json.dumps({"type": "FeatureCollection", "features": feats}))

    lid = "22222222-3333-4444-5555-666666666666"
    jgis = {
        "options": {"projection": "EPSG:4326"},
        "layers": {
            lid: {
                "name": "Regions",
                "type": "VectorLayer",
                "visible": True,
                "parameters": {
                    "opacity": 1.0,
                    "source": "s",
                    "symbologyState": {
                        "layers": [
                            {
                                "id": "L",
                                "rules": [
                                    {
                                        "id": "r",
                                        "fields": ["pop"],
                                        "mappings": [
                                            {
                                                "scale": {
                                                    "scheme": "colorRamp",
                                                    "params": {
                                                        "name": "plasma",
                                                        "nShades": 3,
                                                        "mode": "equal interval",
                                                        "reverse": True,
                                                        "fallback": [0, 0, 0, 0],
                                                        "colorStops": [
                                                            {
                                                                "stop": 0.0,
                                                                "color": [
                                                                    13,
                                                                    8,
                                                                    135,
                                                                    1.0,
                                                                ],
                                                            },
                                                            {
                                                                "stop": 2500.0,
                                                                "color": [
                                                                    204,
                                                                    71,
                                                                    120,
                                                                    1.0,
                                                                ],
                                                            },
                                                            {
                                                                "stop": 5000.0,
                                                                "color": [
                                                                    240,
                                                                    249,
                                                                    33,
                                                                    1.0,
                                                                ],
                                                            },
                                                        ],
                                                    },
                                                },
                                                "channels": [
                                                    "fill-color",
                                                    "circle-fill-color",
                                                ],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                },
            },
        },
        "sources": {
            "s": {
                "name": "s",
                "type": "GeoJSONSource",
                "parameters": {"path": str(gj)},
            },
        },
        "layerTree": [lid],
    }

    out = tmp_path / "regions.qgz"
    logs = export_project_to_qgis(str(out), jgis)
    assert logs["errors"] == []

    reimported = import_project_from_qgis(str(out))
    layer = next(iter(reimported["layers"].values()))
    state = layer["parameters"]["symbologyState"]
    scheme, params, fields, _ = _mapping_for_channel(state["layers"][0], "fill-color")
    assert scheme == "colorRamp"
    assert fields == ["pop"]
    # The picker's ramp name + direction are restored, not defaulted to viridis.
    assert params["name"] == "plasma"
    assert params["reverse"] is True


def test_heatmap_ramp_only_first_stop_transparent():
    """The heatmap gradient is opaque except its first stop.

    A QGIS heatmap maps density 0 to the ramp's first colour, so only that stop
    stays transparent (else the heatmap paints the whole canvas); every other stop
    is fully opaque, matching the source ramp (the old gradual alpha ramp wrongly
    left the first few stops semi-transparent).
    """
    from ..grammar import _heatmap_color_ramp

    grammar_layer = {
        "rules": [
            {
                "fields": ["$density"],
                "mappings": [
                    {
                        "channels": ["pixel-rgb"],
                        "scale": {
                            "scheme": "colorRamp",
                            "params": {"name": "viridis", "reverse": False},
                        },
                    },
                ],
            },
        ],
    }
    ramp = _heatmap_color_ramp(grammar_layer)
    assert ramp is not None
    assert ramp.color1().alpha() == 0  # density 0 -> transparent
    assert ramp.color2().alpha() == 255  # peak density -> opaque
    # Every interior stop is opaque too (no lingering semi-transparency).
    assert [stop.color.alpha() for stop in ramp.stops()] == [255] * len(ramp.stops())


def _vector_tile_ramp_jgis(lid, sid, line_stroke_rgba, stroke_width):
    """A vector tile with a Polygon colorRamp + width and a LineString stroke."""
    state = {
        "layers": [
            {
                "id": "poly",
                "when": [{"type": "geometryType", "value": "Polygon"}],
                "rules": [
                    {
                        "id": "r-fill",
                        "fields": ["best_age_top"],
                        "mappings": [
                            {
                                "channels": ["fill-color", "stroke-color"],
                                "scale": {
                                    "scheme": "colorRamp",
                                    "params": {
                                        "name": "viridis",
                                        "colorStops": [
                                            {
                                                "stop": 1.0,
                                                "color": [68.0, 1.0, 84.0, 1.0],
                                            },
                                            {
                                                "stop": 100.0,
                                                "color": [59.0, 81.0, 139.0, 1.0],
                                            },
                                            {
                                                "stop": 3600.0,
                                                "color": [253.0, 231.0, 37.0, 1.0],
                                            },
                                        ],
                                    },
                                },
                            },
                        ],
                    },
                    {
                        "id": "r-width",
                        "mappings": [
                            {
                                "channels": ["stroke-width"],
                                "scale": {
                                    "scheme": "constant_num",
                                    "params": {"value": stroke_width},
                                },
                            },
                        ],
                    },
                ],
            },
            {
                "id": "line",
                "when": [{"type": "geometryType", "value": "LineString"}],
                "rules": [
                    {
                        "id": "r-line",
                        "mappings": [
                            _constant_rgba(line_stroke_rgba, ["stroke-color"]),
                        ],
                    },
                ],
            },
        ],
    }
    return {
        "options": {
            "projection": "EPSG:3857",
            "extent": [-2e7, -1e7, 2e7, 1e7],
            "useExtent": True,
        },
        "metadata": {},
        "layers": {
            lid: {
                "name": "Tiles",
                "type": "VectorTileLayer",
                "visible": True,
                "parameters": {"opacity": 1.0, "source": sid, "symbologyState": state},
            },
        },
        "sources": {
            sid: {
                "name": "src",
                "type": "VectorTileSource",
                "parameters": {
                    "url": "https://example.com/tiles/{z}/{x}/{y}.pbf",
                    "minZoom": 0,
                    "maxZoom": 14,
                },
            },
        },
        "layerTree": [lid],
    }


def test_vector_tile_colorramp_width_alpha_roundtrip():
    """A vector-tile colorRamp keeps its first stop, stroke width and stroke alpha.

    The first colorRamp stop (the domain minimum) used to be dropped and the next
    class shifted onto it; a constant stroke width was dropped entirely; a stroke
    colour's alpha came back fully opaque. All three now survive the round trip.
    """
    filename = FILES / "project_vt_ramp.qgz"
    if os.path.exists(filename):
        os.remove(filename)

    lid, sid = str(uuid4()), str(uuid4())
    assert export_project_to_qgis(
        filename,
        _vector_tile_ramp_jgis(lid, sid, [0.0, 0.0, 0.0, 0.72], 1.25),
    )
    imported = import_project_from_qgis(filename)
    vt = next(
        layer
        for layer in imported["layers"].values()
        if layer["type"] == "VectorTileLayer"
    )
    state = vt["parameters"]["symbologyState"]

    polygon = next(
        gl
        for gl in state["layers"]
        if gl.get("when", [{}])[0].get("value") == "Polygon"
    )
    scheme, params, fields, _ = _mapping_for_channel(polygon, "fill-color")
    assert scheme == "colorRamp"
    assert fields == ["best_age_top"]
    stops = params["colorStops"]
    # The first stop (value == 1) survives and is not collapsed into the next.
    assert stops[0]["stop"] == 1.0
    assert stops[0]["color"][:3] == [68, 1, 84]
    assert [s["stop"] for s in stops] == [1.0, 100.0, 3600.0]
    # The constant polygon stroke width round-trips.
    width_scheme, width_params, _, _ = _mapping_for_channel(polygon, "stroke-width")
    assert width_scheme == "constant_num"
    assert width_params["value"] == 1.25

    line = next(
        gl
        for gl in state["layers"]
        if gl.get("when", [{}])[0].get("value") == "LineString"
    )
    _, line_params, _, _ = _mapping_for_channel(line, "stroke-color")
    # Alpha survives (8-bit colour precision -> ~0.72).
    assert abs(line_params["value"][3] - 0.72) < 0.01


def test_vector_tile_identical_geometry_rules_collapse():
    """An ungated categorical split across geometries folds back into one layer.

    Exporting an ungated categorical colour produces one style set per geometry
    (polygon/line/point); the reimport must detect they are identical and emit a
    single ungated grammar layer instead of three geometryType-gated ones.
    """
    filename = FILES / "project_vt_collapse.qgz"
    if os.path.exists(filename):
        os.remove(filename)

    lid, sid = str(uuid4()), str(uuid4())
    categorical = {
        "scheme": "categorical",
        "params": {
            "colorRamp": "custom",
            "reverse": False,
            "fallback": [0, 0, 0, 0],
            "colorStops": [
                {"stop": "water", "color": [0.0, 0.0, 255.0, 1.0]},
                {"stop": "land", "color": [0.0, 255.0, 0.0, 1.0]},
            ],
        },
    }
    state = {
        "layers": [
            {
                "id": "tz",
                "rules": [
                    {
                        "id": "r",
                        "fields": ["Layer"],
                        "mappings": [
                            {
                                "channels": [
                                    "fill-color",
                                    "stroke-color",
                                    "circle-fill-color",
                                    "circle-stroke-color",
                                ],
                                "scale": categorical,
                            },
                        ],
                    },
                ],
            },
        ],
    }
    jgis = {
        "options": {
            "projection": "EPSG:3857",
            "extent": [-2e7, -1e7, 2e7, 1e7],
            "useExtent": True,
        },
        "metadata": {},
        "layers": {
            lid: {
                "name": "Tiles",
                "type": "VectorTileLayer",
                "visible": True,
                "parameters": {"opacity": 1.0, "source": sid, "symbologyState": state},
            },
        },
        "sources": {
            sid: {
                "name": "src",
                "type": "VectorTileSource",
                "parameters": {
                    "url": "https://example.com/tiles/{z}/{x}/{y}.pbf",
                    "minZoom": 0,
                    "maxZoom": 14,
                },
            },
        },
        "layerTree": [lid],
    }
    assert export_project_to_qgis(filename, jgis)
    imported = import_project_from_qgis(filename)
    vt = next(
        layer
        for layer in imported["layers"].values()
        if layer["type"] == "VectorTileLayer"
    )
    layers = vt["parameters"]["symbologyState"]["layers"]
    # One ungated layer, not three geometryType-gated rules.
    assert len(layers) == 1
    assert not layers[0].get("when")
    scheme, _, fields, _ = _mapping_for_channel(layers[0], "fill-color")
    assert scheme == "categorical"
    assert fields == ["Layer"]
