import json
from dataclasses import dataclass
from enum import Enum
from io import BytesIO
from pathlib import Path
from unittest import mock

import pytest
from xyzservices import TileProvider

from models import LayerEntry, ThumbnailConfig
from generate import (
    build_gallery_json,
    check_missing_thumbnails,
    find_orphan_images,
    run_thumbnails_mode,
    run_build_mode,
)

from .conftest import GalleryDirs
from .helpers import make_geojson_entry, make_raster_entry, fake_tile_response


class TestCheckMissingThumbnails:
    @mock.patch("generate.gallery", {"Esri": {"WorldGrayCanvas": make_raster_entry()}})
    def test_check_missing_thumbnails_all_present(self, gallery_dirs: GalleryDirs):
        (gallery_dirs.THUMBNAILS_DIR / "Esri-WorldGrayCanvas.png").touch()
        assert check_missing_thumbnails() == []

    @mock.patch("generate.gallery", {"Esri": {"WorldGrayCanvas": make_raster_entry()}})
    def test_check_missing_thumbnails_reports_missing(self, gallery_dirs: GalleryDirs):
        missing = check_missing_thumbnails()
        assert len(missing) == 1
        assert missing[0] == gallery_dirs.THUMBNAILS_DIR / "Esri-WorldGrayCanvas.png"

    @mock.patch(
        "generate.gallery", {"NaturalEarth": {"Coastlines110m": make_geojson_entry()}}
    )
    def test_check_missing_thumbnails_includes_geojson(self, gallery_dirs: GalleryDirs):
        missing = check_missing_thumbnails()
        assert len(missing) == 1
        assert (
            missing[0]
            == gallery_dirs.THUMBNAILS_DIR / "NaturalEarth-Coastlines110m.png"
        )


class TestFindOrphanImages:
    @mock.patch("generate.gallery", {"Esri": {"WorldGrayCanvas": make_raster_entry()}})
    def test_find_orphan_images_none(self, gallery_dirs: GalleryDirs):
        (gallery_dirs.THUMBNAILS_DIR / "Esri-WorldGrayCanvas.png").touch()
        assert find_orphan_images() == []

    @mock.patch("generate.gallery", {"Esri": {"WorldGrayCanvas": make_raster_entry()}})
    def test_find_orphan_images_detects_extra_png(
        self, gallery_dirs: GalleryDirs
    ) -> None:
        (gallery_dirs.THUMBNAILS_DIR / "Esri-WorldGrayCanvas.png").touch()
        (gallery_dirs.THUMBNAILS_DIR / "OldEntry-Removed.png").touch()

        orphans = find_orphan_images()
        assert len(orphans) == 1
        assert orphans[0].name == "OldEntry-Removed.png"

    def test_find_orphan_images_detects_non_png(self, gallery_dirs: GalleryDirs):
        (gallery_dirs.THUMBNAILS_DIR / "Esri-WorldGrayCanvas.png").touch()
        (gallery_dirs.THUMBNAILS_DIR / "stray.jpg").touch()
        gallery = {"Esri": {"WorldGrayCanvas": make_raster_entry()}}
        orphans = find_orphan_images()
        assert any(o.name == "stray.jpg" for o in orphans)

    @mock.patch("generate.gallery", {"Esri": {"WorldGrayCanvas": make_raster_entry()}})
    def test_find_orphan_images_ignores_non_image_files(
        self, gallery_dirs: GalleryDirs
    ):
        (gallery_dirs.THUMBNAILS_DIR / "Esri-WorldGrayCanvas.png").touch()
        (gallery_dirs.THUMBNAILS_DIR / "README.md").touch()
        assert find_orphan_images() == []


class TestBuildGalleryJSON:
    @mock.patch(
        "models.xyzcatalog",
        {
            "Esri": {
                "WorldGrayCanvas": TileProvider(
                    name="Esri.WorldGrayCanvas",
                    url="https://server.arcgisonline.com/{variant}/tile/{z}/{y}/{x}",
                    attribution="Esri",
                    max_zoom=16,
                    variant="Canvas/World_Light_Gray_Base",
                )
            }
        },
    )
    @mock.patch("generate.gallery", {"Esri": {"WorldGrayCanvas": make_raster_entry()}})
    def test_build_gallery_json_tile_entry(self, gallery_dirs: GalleryDirs):
        (gallery_dirs.THUMBNAILS_DIR / "Esri-WorldGrayCanvas.png").touch()

        actual = build_gallery_json()

        assert actual == {
            "Esri": {
                "WorldGrayCanvas": {
                    "thumbnailPath": "thumbnails/Esri-WorldGrayCanvas.png",
                    "name": "Esri.WorldGrayCanvas",
                    "layerType": "RasterLayer",
                    "sourceType": "RasterSource",
                    "sourceParameters": {
                        "url": "https://server.arcgisonline.com/{variant}/tile/{z}/{y}/{x}",
                        "attribution": "Esri",
                        "maxZoom": 16,
                        "minZoom": 0,
                        "urlParameters": {"variant": "Canvas/World_Light_Gray_Base"},
                    },
                    "layerParameters": {"opacity": 1},
                    "description": "Esri",
                },
            },
        }

    @mock.patch(
        "generate.gallery",
        {"NaturalEarth": {"Coastlines110m": make_geojson_entry()}},
    )
    def test_build_gallery_json_geojson_entry(self, gallery_dirs: GalleryDirs):
        (gallery_dirs.THUMBNAILS_DIR / "NaturalEarth-Coastlines110m.png").touch()

        actual = build_gallery_json()

        assert actual == {
            "NaturalEarth": {
                "Coastlines110m": {
                    "thumbnailPath": "thumbnails/NaturalEarth-Coastlines110m.png",
                    "name": "NaturalEarth.Coastlines110m",
                    "layerType": "VectorLayer",
                    "sourceType": "GeoJSONSource",
                    "sourceParameters": {
                        "path": "https://example.com/data.geojson",
                        "attribution": "Example",
                    },
                    "layerParameters": {
                        "opacity": 1,
                        "color": {"stroke-color": "#fff"},
                    },
                    "description": "Example",
                },
            },
        }

    @mock.patch(
        "generate.gallery",
        {
            "MacroStrat": {
                "CartoVector": LayerEntry(
                    name="MacroStrat.CartoVector",
                    layer_type="VectorTileLayer",
                    source_type="VectorTileSource",
                    data_source=TileProvider(
                        name="MacroStrat.CartoVector",
                        url="https://tiles.macrostrat.org/{z}/{x}/{y}.mvt",
                        attribution="Macrostrat",
                        max_zoom=18,
                    ),
                    thumbnail=ThumbnailConfig(lat=47.04, lng=1.30, zoom=5),
                )
            }
        },
    )
    def test_build_gallery_json_vector_tile_default_layer_params(
        self, gallery_dirs: GalleryDirs
    ):
        (gallery_dirs.THUMBNAILS_DIR / "MacroStrat-CartoVector.png").touch()

        actual = build_gallery_json()
        assert actual["MacroStrat"]["CartoVector"]["layerParameters"] == {
            "opacity": 1,
            "symbologyState": {},
        }


class TestRunBuildMode:
    @mock.patch(
        "models.xyzcatalog",
        {
            "Esri": {
                "WorldGrayCanvas": TileProvider(
                    name="Esri.WorldGrayCanvas",
                    url="https://example.com/{z}/{x}/{y}",
                    attribution="Esri",
                    max_zoom=16,
                    variant="test",
                )
            }
        },
    )
    @mock.patch("generate.gallery", {"Esri": {"WorldGrayCanvas": make_raster_entry()}})
    def test_run_build_mode_writes_json(self, gallery_dirs: GalleryDirs):
        (gallery_dirs.THUMBNAILS_DIR / "Esri-WorldGrayCanvas.png").touch()

        run_build_mode()

        assert gallery_dirs.GALLERY_JSON_PATH.exists()
        gallery_json = json.loads(gallery_dirs.GALLERY_JSON_PATH.read_text())
        assert "Esri" in gallery_json
        assert "WorldGrayCanvas" in gallery_json["Esri"]

    @mock.patch("generate.gallery", {"Esri": {"WorldGrayCanvas": make_raster_entry()}})
    def test_run_build_mode_exits_on_missing_thumbnail(self, gallery_dirs: GalleryDirs):
        with pytest.raises(SystemExit) as exc_info:
            run_build_mode()

        assert exc_info.value.code == 1
        assert not gallery_dirs.GALLERY_JSON_PATH.exists()


class TestRunThumbnailsMode:
    @mock.patch(
        "models.xyzcatalog",
        {
            "Esri": {
                "WorldGrayCanvas": TileProvider(
                    name="Esri.WorldGrayCanvas",
                    url="https://example.com/{z}/{x}/{y}.png",
                    attribution="Esri",
                    max_zoom=16,
                )
            }
        },
    )
    @mock.patch("generate.gallery", {"Esri": {"WorldGrayCanvas": make_raster_entry()}})
    def test_run_thumbnails_mode_generates_missing(self, gallery_dirs: GalleryDirs):
        with mock.patch("requests.get", return_value=fake_tile_response()):
            run_thumbnails_mode()

        assert (gallery_dirs.THUMBNAILS_DIR / "Esri-WorldGrayCanvas.png").exists()
        assert gallery_dirs.GALLERY_JSON_PATH.exists()

    @mock.patch(
        "generate.gallery",
        {
            "NaturalEarth": {"Coastlines110m": make_geojson_entry()},
        },
    )
    @pytest.mark.usefixtures("gallery_dirs")
    def test_run_thumbnails_mode_skips_geojson(self, gallery_dirs: GalleryDirs):
        with mock.patch("requests.get") as mock_get:
            run_thumbnails_mode()
            mock_get.assert_not_called()
        assert not any(gallery_dirs.THUMBNAILS_DIR.iterdir())
