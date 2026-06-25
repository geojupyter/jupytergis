import os
from pathlib import Path
from uuid import uuid4

from dirty_equals import IsPartialDict, IsStr

from ..qgis_loader import (
    _parse_gdal_gpkg_source,
    _parse_ogr_gpkg_source,
    _to_gdal_readable_path,
    export_project_to_qgis,
    import_project_from_qgis,
)

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
                        "fillColor": [78, 164, 208, 1.0],
                        "strokeColor": [78, 164, 208, 1.0],
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
                        "strokeColor": [0, 0, 0, 1.0],
                        "colorRamp": "viridis",
                        "nClasses": 9,
                        "mode": "equal interval",
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
                        "renderType": "Categorized",
                        "value": "min_label",
                        "geometryType": "line",
                        "strokeColor": [0, 0, 0, 1.0],
                        "capStyle": "square",
                        "joinStyle": "bevel",
                        "strokeWidth": 1.0,
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

    imported_jgis = import_project_from_qgis(filename)

    assert jgis == imported_jgis


def test_gpkg_uri_helpers_handle_remote_urls():
    """Remote GeoPackage sources must be wrapped in /vsicurl/ for GDAL/OGR,
    and that prefix must be stripped again on import so the jgis path stays
    clean."""
    url = "https://example.com/data.gpkg"
    assert _to_gdal_readable_path(url) == "/vsicurl/" + url
    assert _to_gdal_readable_path("/local/file.gpkg") == "/local/file.gpkg"

    assert _parse_ogr_gpkg_source(f"/vsicurl/{url}|layername=foo") == (url, "foo")
    assert _parse_ogr_gpkg_source("/a/b.gpkg|layername=bar") == ("/a/b.gpkg", "bar")
    assert _parse_ogr_gpkg_source("/not/a/gpkg") is None

    assert _parse_gdal_gpkg_source(f"GPKG:/vsicurl/{url}:tiles") == (url, "tiles")
    assert _parse_gdal_gpkg_source("GPKG:/a/b.gpkg:tiles") == ("/a/b.gpkg", "tiles")
    assert _parse_gdal_gpkg_source("GPKG:/a/b.gpkg") == ("/a/b.gpkg", None)
    assert _parse_gdal_gpkg_source("/not/gpkg") is None


def _base_options():
    return {
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
    }


def test_qgis_bundles_local_geojson_to_sidecar_gpkg():
    """Exporting a jgis whose vector source is a local GeoJSON should produce
    a sidecar .gpkg next to the .qgz, and the re-imported jgis should reference
    that sidecar via a GeoPackageVectorSource."""
    geojson_path = str(FILES / "sample.geojson")
    project_path = FILES / "project_bundle.qgz"
    sidecar_path = FILES / "project_bundle.gpkg"
    for p in (project_path, sidecar_path):
        if p.exists():
            p.unlink()

    layer_id = str(uuid4())
    source_id = str(uuid4())
    jgis = {
        "options": _base_options(),
        "layers": {
            layer_id: {
                "name": "Sample Layer",
                "parameters": {
                    "color": {
                        "fill-color": "#4ea4d0",
                        "stroke-color": "#000000",
                    },
                    "opacity": 1.0,
                    "source": source_id,
                    "symbologyState": {"renderType": "Single Symbol"},
                    "type": "fill",
                },
                "type": "VectorLayer",
                "visible": True,
            },
        },
        "layerTree": [layer_id],
        "sources": {
            source_id: {
                "name": "Sample Source",
                "type": "GeoJSONSource",
                "parameters": {"path": geojson_path},
            },
        },
        "metadata": {},
    }

    logs = export_project_to_qgis(str(project_path), jgis)
    assert logs is not None
    assert logs.get("errors") == []
    assert sidecar_path.exists(), "Sidecar GeoPackage was not created"

    imported_jgis = import_project_from_qgis(str(project_path))
    imported_source = next(iter(imported_jgis["sources"].values()))
    assert imported_source["type"] == "GeoPackageVectorSource"
    assert imported_source["parameters"]["path"] == str(sidecar_path)
    assert imported_source["parameters"]["tables"] == "sample"


def test_qgis_geopackage_round_trip():
    """A jgis with a GeoPackageVectorSource should round-trip through .qgz
    while preserving the source type, path, and table name."""
    geojson_path = str(FILES / "sample.geojson")
    seed_project = FILES / "project_seed.qgz"
    gpkg_path = FILES / "project_seed.gpkg"
    for p in (seed_project, gpkg_path):
        if p.exists():
            p.unlink()

    seed_layer_id = str(uuid4())
    seed_source_id = str(uuid4())
    seed_jgis = {
        "options": _base_options(),
        "layers": {
            seed_layer_id: {
                "name": "Seed Layer",
                "parameters": {
                    "color": {
                        "fill-color": "#4ea4d0",
                        "stroke-color": "#000000",
                    },
                    "opacity": 1.0,
                    "source": seed_source_id,
                    "symbologyState": {"renderType": "Single Symbol"},
                    "type": "fill",
                },
                "type": "VectorLayer",
                "visible": True,
            }
        },
        "layerTree": [seed_layer_id],
        "sources": {
            seed_source_id: {
                "name": "Seed Source",
                "type": "GeoJSONSource",
                "parameters": {"path": geojson_path},
            }
        },
        "metadata": {},
    }
    export_project_to_qgis(str(seed_project), seed_jgis)
    assert gpkg_path.exists()

    project_path = FILES / "project_gpkg.qgz"
    if project_path.exists():
        project_path.unlink()

    layer_id = str(uuid4())
    source_id = str(uuid4())
    jgis = {
        "options": _base_options(),
        "layers": {
            layer_id: {
                "name": "GeoPackage Layer",
                "parameters": {
                    "color": {
                        "fill-color": "#4ea4d0",
                        "stroke-color": "#000000",
                    },
                    "opacity": 1.0,
                    "source": source_id,
                    "symbologyState": {"renderType": "Single Symbol"},
                    "type": "fill",
                },
                "type": "VectorLayer",
                "visible": True,
            }
        },
        "layerTree": [layer_id],
        "sources": {
            source_id: {
                "name": "GeoPackage Source",
                "type": "GeoPackageVectorSource",
                "parameters": {
                    "path": str(gpkg_path),
                    "tables": "sample",
                    "projection": "EPSG:4326",
                },
            }
        },
        "metadata": {},
    }
    logs = export_project_to_qgis(str(project_path), jgis)
    assert logs is not None
    assert logs.get("errors") == []

    imported_jgis = import_project_from_qgis(str(project_path))
    imported_source = imported_jgis["sources"][source_id]
    assert imported_source["type"] == "GeoPackageVectorSource"
    assert imported_source["parameters"]["path"] == str(gpkg_path)
    assert imported_source["parameters"]["tables"] == "sample"
    assert imported_jgis["layers"][layer_id]["type"] == "VectorLayer"
