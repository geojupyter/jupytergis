from dataclasses import dataclass
from pathlib import Path

import pytest


@dataclass
class GalleryDirs:
    PACKAGES_BASE_DIR: Path
    THUMBNAILS_DIR: Path
    GALLERY_JSON_PATH: Path


@pytest.fixture
def gallery_dirs(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> GalleryDirs:
    gallery_dirs = GalleryDirs(
        PACKAGES_BASE_DIR=tmp_path,
        THUMBNAILS_DIR=tmp_path / "thumbnails",
        GALLERY_JSON_PATH=tmp_path / "_generated" / "layer_gallery.json",
    )

    gallery_dirs.THUMBNAILS_DIR.mkdir()

    monkeypatch.setattr(
        "layer_gallery.generate.PACKAGES_BASE_DIR",
        gallery_dirs.PACKAGES_BASE_DIR,
    )
    monkeypatch.setattr(
        "layer_gallery.generate.THUMBNAILS_DIR",
        gallery_dirs.THUMBNAILS_DIR,
    )
    monkeypatch.setattr(
        "layer_gallery.generate.GALLERY_JSON_PATH",
        gallery_dirs.GALLERY_JSON_PATH,
    )

    return gallery_dirs
