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


def test_qgis_saver():
    filename = FILES / "project1.qgz"
    if os.path.exists(filename):
        os.remove(filename)

    layer_ids = [
        str(uuid4()),
        str(uuid4()),
        str(uuid4()),
        str(uuid4()),
        str(uuid4()),
        str(uuid4()),
        str(uuid4()),
    ]
    source_ids = [
        str(uuid4()),
        str(uuid4()),
        str(uuid4()),
        str(uuid4()),
        str(uuid4()),
        str(uuid4()),
        str(uuid4()),
    ]
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
                "parameters": {
                    "opacity": 1.0,
                    "source": source_ids[0],
                },
                "type": "RasterLayer",
                "visible": True,
            },
            layer_ids[1]: {
                "name": "OpenStreetMap1",
                "parameters": {
                    "opacity": 1.0,
                    "source": source_ids[1],
                },
                "type": "RasterLayer",
                "visible": True,
            },
            layer_ids[2]: {
                "name": "Vector Tile Layer",
                "parameters": {
                    "opacity": 1.0,
                    "color": {
                        "circle-fill-color": "#e1598987",
                        "circle-stroke-color": "#e1598987",
                        "fill-color": "#c43c39ff",
                        "stroke-color": "#e5b636ff",
                    },
                    "source": source_ids[2],
                    "type": "fill",
                },
                "type": "VectorTileLayer",
                "visible": True,
            },
            layer_ids[3]: {
                "name": "OpenStreetMap3",
                "parameters": {
                    "opacity": 1.0,
                    "source": source_ids[3],
                },
                "type": "RasterLayer",
                "visible": False,
            },
            layer_ids[4]: {
                "name": "Custom GeoJSON Layer",
                "parameters": {
                    "opacity": 1.0,
                    "source": source_ids[4],
                    "symbologyState": {
                        "renderType": "Single Symbol",
                        "fillColor": [78, 164, 208, 1],
                        "strokeColor": [78, 164, 208, 1],
                        "geometryType": "fill",
                    },
                },
                "type": "VectorLayer",
                "visible": True,
            },
            layer_ids[5]: {
                "name": "Custom GeoJSON Layer",
                "parameters": {
                    "opacity": 1.0,
                    "source": source_ids[5],
                    "symbologyState": {
                        "renderType": "Graduated",
                        "value": "POP_RANK",
                        "geometryType": "fill",
                        "strokeColor": [0, 0, 0, 1],
                        "stops": [
                            {
                                "value": 2.888888888888889,
                                "color": [125.0, 0.0, 179.0, 1.0],
                            },
                            {
                                "value": 4.777777777777778,
                                "color": [116.0, 0.0, 218.0, 1.0],
                            },
                            {
                                "value": 6.666666666666666,
                                "color": [98.0, 74.0, 237.0, 1.0],
                            },
                            {
                                "value": 8.555555555555555,
                                "color": [68.0, 146.0, 231.0, 1.0],
                            },
                            {
                                "value": 10.444444444444445,
                                "color": [0.0, 204.0, 197.0, 1.0],
                            },
                            {
                                "value": 12.333333333333334,
                                "color": [0.0, 247.0, 146.0, 1.0],
                            },
                            {
                                "value": 14.222222222222223,
                                "color": [0.0, 255.0, 88.0, 1.0],
                            },
                            {
                                "value": 16.11111111111111,
                                "color": [40.0, 255.0, 8.0, 1.0],
                            },
                            {"value": 18.0, "color": [147.0, 255.0, 0.0, 1.0]},
                        ],
                    },
                },
                "type": "VectorLayer",
                "visible": True,
            },
            layer_ids[6]: {
                "name": "Custom GeoJSON Layer",
                "parameters": {
                    "opacity": 1.0,
                    "source": source_ids[6],
                    "symbologyState": {
                        "colorRamp": "viridis",
                        "mode": "equal interval",
                        "nClasses": 9,
                        "renderType": "Categorized",
                        "value": "min_label",
                        "geometryType": "line",
                        "capStyle": "square",
                        "joinStyle": "bevel",
                        "strokeWidth": 1.0,
                        "stops": [
                            {"value": 6.0, "color": [125.0, 0.0, 179.0, 1.0]},
                            {"value": 7.0, "color": [121.0, 0.0, 199.0, 1.0]},
                            {"value": 7.4, "color": [116.0, 0.0, 218.0, 1.0]},
                            {"value": 7.5, "color": [107.0, 37.0, 228.0, 1.0]},
                            {"value": 7.9, "color": [98.0, 74.0, 237.0, 1.0]},
                            {"value": 8.0, "color": [83.0, 110.0, 234.0, 1.0]},
                            {"value": 8.4, "color": [68.0, 146.0, 231.0, 1.0]},
                            {"value": 8.5, "color": [34.0, 175.0, 214.0, 1.0]},
                            {"value": 8.6, "color": [0.0, 204.0, 197.0, 1.0]},
                            {"value": 8.9, "color": [0.0, 247.0, 146.0, 1.0]},
                            {"value": 9.0, "color": [0.0, 251.0, 117.0, 1.0]},
                            {"value": 9.5, "color": [0.0, 255.0, 88.0, 1.0]},
                            {"value": 9.6, "color": [20.0, 255.0, 48.0, 1.0]},
                            {"value": 10.0, "color": [40.0, 255.0, 8.0, 1.0]},
                            {"value": 10.1, "color": [94.0, 255.0, 4.0, 1.0]},
                            {"value": 10.2, "color": [147.0, 255.0, 0.0, 1.0]},
                        ],
                        "fallbackColor": [0.0, 0.0, 0.0, 0.0],
                    },
                },
                "type": "VectorLayer",
                "visible": True,
            },
        },
        "layerTree": [
            layer_ids[0],
            layer_ids[1],
            {
                "layers": [
                    layer_ids[2],
                    layer_ids[3],
                ],
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
                    "path": "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson"
                },
                "type": "GeoJSONSource",
            },
            source_ids[5]: {
                "name": "Custom GeoJSON Layer Source",
                "parameters": {
                    "path": "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson"
                },
                "type": "GeoJSONSource",
            },
            source_ids[6]: {
                "name": "Custom GeoJSON Layer Source",
                "parameters": {
                    "path": "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_roads.geojson"
                },
                "type": "GeoJSONSource",
            },
        },
        "metadata": {},
    }

    assert export_project_to_qgis(filename, jgis)

    imported_jgis = import_project_from_qgis(filename)

    assert jgis == imported_jgis
