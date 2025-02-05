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
                    "color": {
                        "fill-color": "#4ea4d0",
                        "stroke-color": "#4ea4d0",
                    },
                    "opacity": 1.0,
                    "source": source_ids[4],
                    "symbologyState": {"renderType": "Single Symbol"},
                    "type": "fill",
                },
                "type": "VectorLayer",
                "visible": True,
            },
            layer_ids[5]: {
                "name": "Custom GeoJSON Layer",
                "parameters": {
                    "color": {
                        "fill-color": [
                            "interpolate",
                            ["linear"],
                            ["get", "POP_RANK"],
                            2.888888888888889,
                            [125.0, 0.0, 179.0, 1.0],
                            4.777777777777778,
                            [116.0, 0.0, 218.0, 1.0],
                            6.666666666666666,
                            [98.0, 74.0, 237.0, 1.0],
                            8.555555555555555,
                            [68.0, 146.0, 231.0, 1.0],
                            10.444444444444445,
                            [0.0, 204.0, 197.0, 1.0],
                            12.333333333333334,
                            [0.0, 247.0, 146.0, 1.0],
                            14.222222222222223,
                            [0.0, 255.0, 88.0, 1.0],
                            16.11111111111111,
                            [40.0, 255.0, 8.0, 1.0],
                            18.0,
                            [147.0, 255.0, 0.0, 1.0],
                        ],
                        "stroke-color": "#000000",
                    },
                    "opacity": 1.0,
                    "source": source_ids[5],
                    "symbologyState": {
                        "renderType": "Graduated",
                        "value": "POP_RANK",
                    },
                    "type": "fill",
                },
                "type": "VectorLayer",
                "visible": True,
            },
            layer_ids[6]: {
                "name": "Custom GeoJSON Layer",
                "parameters": {
                    "color": {
                        "stroke-color": [
                            "case",
                            ["==", ["get", "min_label"], 6.0],
                            [125.0, 0.0, 179.0, 1.0],
                            ["==", ["get", "min_label"], 7.0],
                            [121.0, 0.0, 199.0, 1.0],
                            ["==", ["get", "min_label"], 7.4],
                            [116.0, 0.0, 218.0, 1.0],
                            ["==", ["get", "min_label"], 7.5],
                            [107.0, 37.0, 228.0, 1.0],
                            ["==", ["get", "min_label"], 7.9],
                            [98.0, 74.0, 237.0, 1.0],
                            ["==", ["get", "min_label"], 8.0],
                            [83.0, 110.0, 234.0, 1.0],
                            ["==", ["get", "min_label"], 8.4],
                            [68.0, 146.0, 231.0, 1.0],
                            ["==", ["get", "min_label"], 8.5],
                            [34.0, 175.0, 214.0, 1.0],
                            ["==", ["get", "min_label"], 8.6],
                            [0.0, 204.0, 197.0, 1.0],
                            ["==", ["get", "min_label"], 8.9],
                            [0.0, 247.0, 146.0, 1.0],
                            ["==", ["get", "min_label"], 9.0],
                            [0.0, 251.0, 117.0, 1.0],
                            ["==", ["get", "min_label"], 9.5],
                            [0.0, 255.0, 88.0, 1.0],
                            ["==", ["get", "min_label"], 9.6],
                            [20.0, 255.0, 48.0, 1.0],
                            ["==", ["get", "min_label"], 10.0],
                            [40.0, 255.0, 8.0, 1.0],
                            ["==", ["get", "min_label"], 10.1],
                            [94.0, 255.0, 4.0, 1.0],
                            ["==", ["get", "min_label"], 10.2],
                            [147.0, 255.0, 0.0, 1.0],
                            [0.0, 0.0, 0.0, 0.0],
                        ],
                        "stroke-line-cap": "square",
                        "stroke-line-join": "bevel",
                        "stroke-width": 1.0,
                    },
                    "opacity": 1.0,
                    "source": source_ids[6],
                    "symbologyState": {
                        "colorRamp": "cool",
                        "mode": "",
                        "nClasses": "",
                        "renderType": "Categorized",
                        "value": "min_label",
                    },
                    "type": "line",
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
