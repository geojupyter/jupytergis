"""Functions related to generating thumbnails."""

from io import BytesIO

import mercantile
import requests
from PIL import Image
from requests.exceptions import RequestException

from layer_gallery.models import LayerEntry
from layer_gallery.utils import build_url_parameters, resolve_tile_provider


def generate_thumbnail(
    *,
    entry: LayerEntry,
) -> Image.Image:
    """Fetch a 2*2 tile grid, stitch, resize to 256*256, and return."""
    tile_provider = resolve_tile_provider(entry)
    if tile_provider is None:
        raise RuntimeError("Programmer error.")

    url_parameters = build_url_parameters(tile_provider)

    tile_size = entry.thumbnail.tile_size

    tile = mercantile.tile(
        entry.thumbnail.lng,
        entry.thumbnail.lat,
        entry.thumbnail.zoom,
        truncate=True,
    )
    x, y, z = tile.x, tile.y, tile.z

    rows = []
    for dy in range(2):
        row = []
        for dx in range(2):
            img = _fetch_tile(
                url_template=tile_provider["url"],
                x=x + dx,
                y=y + dy,
                z=z,
                **url_parameters,
            )
            if img.size != (tile_size, tile_size):
                img = img.resize((tile_size, tile_size), Image.Resampling.LANCZOS)
            row.append(img)
        rows.append(row)

    canvas = Image.new("RGB", (tile_size * 2, tile_size * 2))
    for dy, row in enumerate(rows):
        for dx, img in enumerate(row):
            canvas.paste(img, (dx * tile_size, dy * tile_size))

    return canvas.resize((256, 256), Image.Resampling.LANCZOS)


def _fetch_tile(
    *,
    url_template: str,
    x: int,
    y: int,
    z: int,
    s: str = "a",
    **kwargs: str | int,
) -> Image.Image:
    """Fetch a tile."""
    try:
        url = url_template.format(x=x, y=y, z=z, s=s, **kwargs)
        resp = requests.get(url, headers={"User-Agent": "JupyterGIS"}, timeout=10)
        resp.raise_for_status()
        return Image.open(BytesIO(resp.content))
    except RequestException as e:
        raise RuntimeError("Failed to fetch tile") from e
