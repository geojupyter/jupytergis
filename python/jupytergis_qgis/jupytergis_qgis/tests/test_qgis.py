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


def _fill_mapping(symbology_state):
    """Return (scheme, fields, params) of the mapping driving 'fill-color'."""
    for grammar_layer in symbology_state.get("layers", []):
        for rule in grammar_layer.get("rules", []):
            for mapping in rule.get("mappings", []):
                if "fill-color" in mapping.get("channels", []):
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
                            },
                        },
                        "channels": ["fill-color", "circle-fill-color"],
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

    # Categorized -> categorical scale keyed on the original field.
    scheme, fields, _ = _fill_mapping(
        imported_layers[layer_ids[6]]["parameters"]["symbologyState"],
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

    # One jGIS layer with two grammar layers -> two QGIS layers -> two jGIS layers.
    vlayers = [
        layer for layer in imported["layers"].values() if layer["type"] == "VectorLayer"
    ]
    assert len(vlayers) == 2

    # Exactly one of them is a KDE heatmap (preprocess kde).
    kde_layers = [
        layer
        for layer in vlayers
        if any(
            gl.get("preprocess")
            for gl in layer["parameters"]["symbologyState"].get("layers", [])
        )
    ]
    assert len(kde_layers) == 1
    grammar_layer = kde_layers[0]["parameters"]["symbologyState"]["layers"][0]
    assert grammar_layer["preprocess"][0]["type"] == "kde"


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

    # Points layer: data-defined marker size from the scalar scale.
    point_layers = [
        layer
        for layer in eq_layers
        if isinstance(layer.renderer(), QgsSingleSymbolRenderer)
    ]
    assert len(point_layers) == 1
    symbol = point_layers[0].renderer().symbol()
    assert isinstance(symbol, QgsMarkerSymbol)
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
