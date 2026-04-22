import json
from unittest import mock

import pytest
from xyzservices import TileProvider

from layer_gallery.generate import (
    _build_gallery_entry,
    _check_missing_thumbnails,
    _find_orphan_images,
    run,
)
from layer_gallery.models import LayerEntry, ThumbnailConfig

from .conftest import GalleryDirs
from .helpers import fake_tile_response, make_geojson_entry, make_raster_entry


class TestCheckMissingThumbnails:
    @mock.patch(
        "layer_gallery.generate.gallery",
        {"Esri": {"WorldGrayCanvas": make_raster_entry()}},
    )
    def test_check_missing_thumbnails_all_present(
        self,
        gallery_dirs: GalleryDirs,
    ) -> None:
        (gallery_dirs.THUMBNAILS_DIR / "Esri-WorldGrayCanvas.png").touch()
        assert _check_missing_thumbnails() == []

    @mock.patch(
        "layer_gallery.generate.gallery",
        {"Esri": {"WorldGrayCanvas": make_raster_entry()}},
    )
    def test_check_missing_thumbnails_reports_missing(
        self,
        gallery_dirs: GalleryDirs,
    ) -> None:
        missing = _check_missing_thumbnails()
        assert len(missing) == 1
        assert missing[0] == gallery_dirs.THUMBNAILS_DIR / "Esri-WorldGrayCanvas.png"

    @mock.patch(
        "layer_gallery.generate.gallery",
        {"NaturalEarth": {"Coastlines110m": make_geojson_entry()}},
    )
    def test_check_missing_thumbnails_includes_geojson(
        self,
        gallery_dirs: GalleryDirs,
    ) -> None:
        missing = _check_missing_thumbnails()
        assert len(missing) == 1
        assert (
            missing[0]
            == gallery_dirs.THUMBNAILS_DIR / "NaturalEarth-Coastlines110m.png"
        )


class TestFindOrphanImages:
    @mock.patch(
        "layer_gallery.generate.gallery",
        {"Esri": {"WorldGrayCanvas": make_raster_entry()}},
    )
    def test_find_orphan_images_none(self, gallery_dirs: GalleryDirs) -> None:
        (gallery_dirs.THUMBNAILS_DIR / "Esri-WorldGrayCanvas.png").touch()
        assert _find_orphan_images() == []

    @mock.patch(
        "layer_gallery.generate.gallery",
        {"Esri": {"WorldGrayCanvas": make_raster_entry()}},
    )
    def test_find_orphan_images_detects_extra_png(
        self,
        gallery_dirs: GalleryDirs,
    ) -> None:
        (gallery_dirs.THUMBNAILS_DIR / "Esri-WorldGrayCanvas.png").touch()
        (gallery_dirs.THUMBNAILS_DIR / "OldEntry-Removed.png").touch()

        orphans = _find_orphan_images()
        assert len(orphans) == 1
        assert orphans[0].name == "OldEntry-Removed.png"

    @mock.patch(
        "layer_gallery.generate.gallery",
        {"Esri": {"WorldGrayCanvas": make_raster_entry()}},
    )
    def test_find_orphan_images_detects_non_png(
        self,
        gallery_dirs: GalleryDirs,
    ) -> None:
        (gallery_dirs.THUMBNAILS_DIR / "Esri-WorldGrayCanvas.png").touch()
        (gallery_dirs.THUMBNAILS_DIR / "stray.jpg").touch()
        orphans = _find_orphan_images()
        assert any(o.name == "stray.jpg" for o in orphans)

    @mock.patch(
        "layer_gallery.generate.gallery",
        {"Esri": {"WorldGrayCanvas": make_raster_entry()}},
    )
    def test_find_orphan_images_ignores_non_image_files(
        self,
        gallery_dirs: GalleryDirs,
    ) -> None:
        (gallery_dirs.THUMBNAILS_DIR / "Esri-WorldGrayCanvas.png").touch()
        (gallery_dirs.THUMBNAILS_DIR / "README.md").touch()
        assert _find_orphan_images() == []


class TestBuildGalleryEntry:
    @mock.patch(
        "layer_gallery.models.xyzcatalog",
        {
            "Esri": {
                "WorldGrayCanvas": TileProvider(
                    name="Esri.WorldGrayCanvas",
                    url="https://server.arcgisonline.com/{variant}/tile/{z}/{y}/{x}",
                    attribution="Esri",
                    max_zoom=16,
                    variant="Canvas/World_Light_Gray_Base",
                ),
            },
        },
    )
    @pytest.mark.usefixtures("gallery_dirs")
    def test_build_gallery_entry_tile_provider(self) -> None:
        actual = _build_gallery_entry(make_raster_entry())

        assert actual == {
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
        }

    @pytest.mark.usefixtures("gallery_dirs")
    def test_build_gallery_entry_geojson(self) -> None:
        actual = _build_gallery_entry(make_geojson_entry())

        assert actual == {
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
        }

    @pytest.mark.usefixtures("gallery_dirs")
    def test_build_gallery_entry_vector_tile_default_layer_params(self) -> None:
        actual = _build_gallery_entry(
            LayerEntry(
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
            ),
        )
        assert actual["layerParameters"] == {
            "opacity": 1,
            "symbologyState": {},
        }


class TestRun:
    @mock.patch(
        "layer_gallery.models.xyzcatalog",
        {
            "Esri": {
                "WorldGrayCanvas": TileProvider(
                    name="Esri.WorldGrayCanvas",
                    url="https://example.com/{z}/{x}/{y}",
                    attribution="Esri",
                    max_zoom=16,
                    variant="test",
                ),
            },
        },
    )
    @mock.patch(
        "layer_gallery.generate.gallery",
        {"Esri": {"WorldGrayCanvas": make_raster_entry()}},
    )
    def test_run_build_mode_writes_json(self, gallery_dirs: GalleryDirs) -> None:
        (gallery_dirs.THUMBNAILS_DIR / "Esri-WorldGrayCanvas.png").touch()

        run(generate_thumbnails=False)

        assert gallery_dirs.GALLERY_JSON_PATH.exists()
        gallery_json = json.loads(gallery_dirs.GALLERY_JSON_PATH.read_text())
        assert "Esri" in gallery_json
        assert "WorldGrayCanvas" in gallery_json["Esri"]

    @mock.patch(
        "layer_gallery.generate.gallery",
        {"Esri": {"WorldGrayCanvas": make_raster_entry()}},
    )
    def test_run_build_mode_exits_on_missing_thumbnail(
        self,
        gallery_dirs: GalleryDirs,
    ) -> None:
        with pytest.raises(SystemExit) as exc_info:
            run(generate_thumbnails=False)

        assert exc_info.value.code == 1
        assert not gallery_dirs.GALLERY_JSON_PATH.exists()

    @mock.patch(
        "layer_gallery.models.xyzcatalog",
        {
            "Esri": {
                "WorldGrayCanvas": TileProvider(
                    name="Esri.WorldGrayCanvas",
                    url="https://example.com/{z}/{x}/{y}.png",
                    attribution="Esri",
                    max_zoom=16,
                ),
            },
        },
    )
    @mock.patch(
        "layer_gallery.generate.gallery",
        {"Esri": {"WorldGrayCanvas": make_raster_entry()}},
    )
    def test_run_thumbnails_mode_generates_missing(
        self,
        gallery_dirs: GalleryDirs,
    ) -> None:
        with mock.patch("requests.get", return_value=fake_tile_response()):
            run(generate_thumbnails=True)

        assert (gallery_dirs.THUMBNAILS_DIR / "Esri-WorldGrayCanvas.png").exists()
        assert gallery_dirs.GALLERY_JSON_PATH.exists()

    @mock.patch(
        "layer_gallery.generate.gallery",
        {
            "NaturalEarth": {"Coastlines110m": make_geojson_entry()},
        },
    )
    @pytest.mark.usefixtures("gallery_dirs")
    def test_run_thumbnails_mode_skips_geojson(self, gallery_dirs: GalleryDirs) -> None:
        with mock.patch("requests.get") as mock_get:
            run(generate_thumbnails=True)
            mock_get.assert_not_called()
        assert not any(gallery_dirs.THUMBNAILS_DIR.iterdir())
