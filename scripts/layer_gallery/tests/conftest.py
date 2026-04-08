from dataclasses import dataclass
from pathlib import Path
from unittest import mock

import pytest

from PIL import Image


@dataclass
class GalleryDirs:
    PACKAGES_BASE_DIR: Path
    # TODO: Do we need these? They are both relative to PACKAGES_BASE_DIR...
    THUMBNAILS_DIR: Path
    GALLERY_JSON_PATH: Path


@pytest.fixture
def gallery_dirs(tmp_path, monkeypatch) -> GalleryDirs:
    gallery_dirs = GalleryDirs(
        PACKAGES_BASE_DIR=tmp_path,
        THUMBNAILS_DIR=tmp_path / "thumbnails",
        GALLERY_JSON_PATH=tmp_path / "_generated" / "layer_gallery.json",
    )

    gallery_dirs.THUMBNAILS_DIR.mkdir()

    monkeypatch.setattr("generate.PACKAGES_BASE_DIR", gallery_dirs.PACKAGES_BASE_DIR)
    monkeypatch.setattr("generate.THUMBNAILS_DIR", gallery_dirs.THUMBNAILS_DIR)
    monkeypatch.setattr("generate.GALLERY_JSON_PATH", gallery_dirs.GALLERY_JSON_PATH)

    return gallery_dirs


@pytest.fixture
def _fake_tile_response(color=(100, 150, 200)) -> mock.MagicMock:
    img = Image.new("RGB", (256, 256), color)
    buf = BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    mock_resp = mock.MagicMock()
    mock_resp.content = buf.read()
    mock_resp.raise_for_status = mock.MagicMock()
    return mock_resp
