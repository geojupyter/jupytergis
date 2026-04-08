"""Layer gallery generator.

python generate.py
    Build mode, run by packages/base/package.json build:gallery before TypeScript
    compilation. Validates that every gallery entry has a thumbnail on disk, then
    writes packages/base/_generated/layer_gallery.json. If any thumbnails are missing,
    exits with error code 1 and lists the missing thumbnail paths — the JSON is not
    written because it would reference non-existent files.

python generate.py --thumbnails
    Thumbnail mode, run manually by developers when adding or updating gallery entries.
    Fetches tiles for entries that lack a thumbnail and saves 256×256 PNGs to
    packages/base/layer_gallery_thumbnails/. GeoJSON entries are skipped (create their
    thumbnails manually). Reports any orphaned images. Writes layer_gallery.json at the
    end even if GeoJSON thumbnails are still missing, so developers can inspect the
    output while working incrementally.
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any


THIS_DIR = Path(__file__).parent

sys.path.insert(0, str(THIS_DIR))
from config import gallery
from models import TileProvider, LayerEntry, GeoJSONLayer
from thumbnail import generate_thumbnail
from utils import build_url_parameters, resolve_tile_provider

REPO_ROOT = THIS_DIR.parent.parent
PACKAGES_BASE_DIR = REPO_ROOT / "packages" / "base"
THUMBNAILS_DIR = PACKAGES_BASE_DIR / "layer_gallery_thumbnails"
GALLERY_JSON_PATH = PACKAGES_BASE_DIR / "_generated" / "layer_gallery.json"

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp", ".tiff"}


def check_missing_thumbnails() -> list[Path]:
    """Return paths of expected thumbnails that don't exist on disk."""
    missing = []
    for layers in gallery.values():
        for entry in layers.values():
            path = THUMBNAILS_DIR / entry.thumbnail_filename
            if not path.exists():
                missing.append(path)
    return missing


def find_orphan_images() -> list[Path]:
    """Return image files in thumbnail_dir with no corresponding gallery entry."""
    expected = {
        THUMBNAILS_DIR / entry.thumbnail_filename
        for layers in gallery.values()
        for entry in layers.values()
    }
    orphans = [
        f
        for f in sorted(THUMBNAILS_DIR.iterdir())
        if f.suffix.lower() in IMAGE_EXTENSIONS and f not in expected
    ]
    return orphans


def _layer_parameters(entry: LayerEntry) -> dict[str, Any]:
    if entry.layer_parameters is not None:
        return entry.layer_parameters

    if isinstance(entry.data_source, GeoJSONLayer):
        return {}

    if entry.layer_type == "VectorTileLayer":
        return {"opacity": 1, "symbologyState": {}}

    return {"opacity": 1}


def build_gallery_json() -> dict:
    """Build the layer_gallery.json dict from the gallery config."""
    result = {}
    for category, layers in gallery.items():
        category_result = {}
        for layer_id, entry in layers.items():
            thumb_path = THUMBNAILS_DIR / entry.thumbnail_filename
            relative_thumb = str(thumb_path.relative_to(PACKAGES_BASE_DIR))

            if isinstance(entry.data_source, GeoJSONLayer):
                source_params = dict(entry.data_source)
            else:
                tile_provider = resolve_tile_provider(entry)
                source_params = {
                    "url": tile_provider["url"],
                    "attribution": tile_provider.get("attribution"),
                    "maxZoom": tile_provider.get("max_zoom"),
                    "minZoom": tile_provider.get("min_zoom") or 0,
                    "urlParameters": build_url_parameters(tile_provider),
                }

            category_result[layer_id] = {
                "thumbnailPath": relative_thumb,
                "name": entry.name,
                "layerType": entry.layer_type,
                "sourceType": entry.source_type,
                "sourceParameters": source_params,
                "layerParameters": _layer_parameters(entry),
                "description": entry.description or source_params["attribution"],
            }
        result[category] = category_result
    return result


def _write_gallery_json(data: ...) -> None:
    GALLERY_JSON_PATH.parent.mkdir(exist_ok=True)
    with open(GALLERY_JSON_PATH, "w") as f:
        json.dump(data, f, indent=2)
    print(f"Wrote {GALLERY_JSON_PATH}")


def run_build_mode() -> None:
    missing = check_missing_thumbnails()
    if missing:
        print("Error: Missing thumbnails:")
        for path in missing:
            print(f"❌  {path}")
        print(
            "\nRun `python scripts/layer_gallery/generate.py --thumbnails` to generate them."
        )
        sys.exit(1)

    data = build_gallery_json()
    _write_gallery_json(data)


def run_thumbnails_mode() -> None:
    THUMBNAILS_DIR.mkdir(parents=True, exist_ok=True)

    for layers in gallery.values():
        for entry in layers.values():
            out_path = THUMBNAILS_DIR / entry.thumbnail_filename
            if out_path.exists():
                continue

            if isinstance(entry.data_source, GeoJSONLayer):
                print(f"⚠️  Skipping {entry.name} (GeoJSON — create thumbnail manually)")
                continue

            print(f"  Generating {out_path.name} ...")
            thumbnail = generate_thumbnail(entry=entry)
            thumbnail.save(out_path, optimize=True)
            print(f"  Generated {out_path.name}")

    orphans = find_orphan_images()
    if orphans:
        print("\nOrphan images (no corresponding gallery entry) — delete manually:")
        for path in orphans:
            print(f"🗑️  {path}")

    data = build_gallery_json()
    _write_gallery_json(data)


def main() -> None:
    parser = argparse.ArgumentParser(description="Layer gallery generator")
    parser.add_argument(
        "--thumbnails",
        action="store_true",
        help="Generate missing thumbnails and check for orphans",
    )
    args = parser.parse_args()

    if args.thumbnails:
        run_thumbnails_mode()
    else:
        run_build_mode()


if __name__ == "__main__":
    main()
