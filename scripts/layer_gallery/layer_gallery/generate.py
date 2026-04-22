"""Layer gallery generator.

python generate.py
    Build mode, run by packages/base/package.json build:gallery before TypeScript
    compilation. Validates that every gallery entry has a thumbnail on disk, then
    writes packages/base/_generated/layer_gallery.json. If any thumbnails are missing,
    exits with error code 1 and lists the missing thumbnail paths — the JSON is not
    written because it would reference non-existent files.

python generate.py --thumbnails
    Thumbnail mode, run manually by developers when adding or updating gallery entries.
    Fetches tiles for entries that lack a thumbnail and saves 256*256 PNGs to
    packages/base/layer_gallery_thumbnails/. GeoJSON entries are skipped (create their
    thumbnails manually). Reports any orphaned images. Writes layer_gallery.json at the
    end even if GeoJSON thumbnails are still missing, so developers can inspect the
    output while working incrementally.
"""

import argparse
import json
import sys
from io import BytesIO
from pathlib import Path
from typing import Any, Literal

import oxipng

from layer_gallery.config import gallery
from layer_gallery.models import GeoJSONLayer, LayerEntry
from layer_gallery.thumbnail import generate_thumbnail
from layer_gallery.utils import (
    build_url_parameters,
    dict_keys_to_camel,
    resolve_tile_provider,
)

THIS_DIR = Path(__file__).parent
REPO_ROOT = THIS_DIR.parent.parent.parent
PACKAGES_BASE_DIR = REPO_ROOT / "packages" / "base"
THUMBNAILS_DIR = PACKAGES_BASE_DIR / "layer_gallery_thumbnails"
GALLERY_JSON_PATH = PACKAGES_BASE_DIR / "_generated" / "layer_gallery.json"

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp", ".tiff"}


def _check_missing_thumbnails() -> list[Path]:
    """Return paths of expected thumbnails that don't exist on disk."""
    missing = []
    for layers in gallery.values():
        for entry in layers.values():
            path = THUMBNAILS_DIR / entry.thumbnail_filename
            if not path.exists():
                missing.append(path)
    return missing


def _report_missing_thumbnails(
    *,
    severity: Literal["Warning", "Error"],
    exit_on_missing: bool = False,
) -> None:
    missing = _check_missing_thumbnails()
    if missing:
        print(f"{severity}: Missing thumbnails:")

        icon = "❌" if severity == "Error" else "⚠️"
        for path in missing:
            print(f"{icon}  {path}")

        print("\nRun this script with the `--thumbnails` flag to generate thumbnails.")

        if exit_on_missing:
            sys.exit(1)


def _find_orphan_images() -> list[Path]:
    """Return image files in thumbnail_dir with no corresponding gallery entry."""
    expected = {
        THUMBNAILS_DIR / entry.thumbnail_filename
        for layers in gallery.values()
        for entry in layers.values()
    }
    return [
        f
        for f in sorted(THUMBNAILS_DIR.iterdir())
        if f.suffix.lower() in IMAGE_EXTENSIONS and f not in expected
    ]


def _layer_parameters(entry: LayerEntry) -> dict[str, Any]:
    if entry.layer_parameters is not None:
        return entry.layer_parameters

    if isinstance(entry.data_source, GeoJSONLayer):
        return {}

    if entry.layer_type == "VectorTileLayer":
        return {"opacity": 1, "symbologyState": {}}

    return {"opacity": 1}


def _write_gallery_json(data: dict[str, Any]) -> None:
    GALLERY_JSON_PATH.parent.mkdir(exist_ok=True)
    with GALLERY_JSON_PATH.open("w") as f:
        json.dump(data, f, indent=2)
    print(f"Generated {GALLERY_JSON_PATH}")


def _make_thumbnail(entry: LayerEntry) -> None:
    thumbnail_path = THUMBNAILS_DIR / entry.thumbnail_filename
    if thumbnail_path.exists():
        return

    if isinstance(entry.data_source, GeoJSONLayer):
        print(f"⚠️  Skipping {entry.name} (GeoJSON — create thumbnail manually)")
        return

    thumbnail = generate_thumbnail(entry=entry)

    buf = BytesIO()
    thumbnail.save(buf, format="PNG")
    thumbnail_path.write_bytes(oxipng.optimize_from_memory(buf.getvalue(), level=6))
    print(f"Generated {thumbnail_path.name}")


def _report_thumbnail_orphans() -> None:
    orphans = _find_orphan_images()
    if orphans:
        print("\nOrphan images (no corresponding gallery entry) — delete manually:")
        for path in orphans:
            print(f"🗑️  {path}")


def _build_gallery_entry(entry: LayerEntry) -> dict[str, Any]:
    thumb_path = THUMBNAILS_DIR / entry.thumbnail_filename
    relative_thumb = str(thumb_path.relative_to(PACKAGES_BASE_DIR))

    if isinstance(entry.data_source, GeoJSONLayer):
        source_params = dict(entry.data_source)
    else:
        tile_provider = resolve_tile_provider(entry)
        if tile_provider is None:
            raise RuntimeError("Programmer error.")
        source_params = {
            "url": tile_provider["url"],
            "attribution": tile_provider.get("attribution"),
            "maxZoom": tile_provider.get("max_zoom"),
            "minZoom": tile_provider.get("min_zoom") or 0,
            "urlParameters": dict_keys_to_camel(build_url_parameters(tile_provider)),
        }

    return {
        "thumbnailPath": relative_thumb,
        "name": entry.name,
        "layerType": entry.layer_type,
        "sourceType": entry.source_type,
        "sourceParameters": source_params,
        "layerParameters": _layer_parameters(entry),
        "description": entry.description or source_params["attribution"],
    }


def run(*, generate_thumbnails: bool) -> None:
    """The main internal entrypoint for the layer gallery generator."""  # noqa: D401
    if generate_thumbnails:
        THUMBNAILS_DIR.mkdir(parents=True, exist_ok=True)
    else:
        _report_missing_thumbnails(severity="Error", exit_on_missing=True)

    result = {}
    for category, layers in gallery.items():
        category_entries = {}
        for layer_id, entry in layers.items():
            if generate_thumbnails:
                _make_thumbnail(entry)

            category_entries[layer_id] = _build_gallery_entry(entry)
        result[category] = category_entries

    if generate_thumbnails:
        _report_missing_thumbnails(severity="Warning")
        _report_thumbnail_orphans()

    _write_gallery_json(result)


def cli() -> None:
    """The main user entrypoint for the layer gallery generator."""  # noqa: D401
    parser = argparse.ArgumentParser(description="Layer gallery generator")
    parser.add_argument(
        "--thumbnails",
        action="store_true",
        help="Generate missing thumbnails and check for orphans",
    )
    args = parser.parse_args()

    run(generate_thumbnails=args.thumbnails)


if __name__ == "__main__":
    cli()
