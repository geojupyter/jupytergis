from datetime import date, timedelta
import json
from io import BytesIO
import os
import subprocess

import requests
from PIL import Image
import mercantile
from xyzservices import providers, TileProvider
import string
from requests.exceptions import RequestException

with open("layer_gallery/thumbnail_config.json", "r", encoding="utf-8") as f:
    provider_config = json.load(f)

THUMBNAILS_LOCATION = "layer_gallery"


def snake_to_camel(s):
    """
    Convect snake case strings into camel case ones
    """
    parts = s.split("_")
    return parts[0] + "".join(word.capitalize() for word in parts[1:])


def dict_keys_to_camel(obj):
    """
    Convect keys of a dict from snake case to camel case
    """
    if isinstance(obj, dict):
        return {snake_to_camel(k): dict_keys_to_camel(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [dict_keys_to_camel(item) for item in obj]
    else:
        return obj


def placeholder_tile(size):
    """
    Provide a white empty placeholder image
    """
    return Image.new("RGB", size, (220, 220, 220))


def extract_placeholders(url_template):
    """
    Extract the placeholders from an url_template
    """
    formatter = string.Formatter()
    return {
        field_name
        for _, field_name, _, _ in formatter.parse(url_template)
        if field_name
    }


def build_url_parameters(tile_provider):
    """
    Build the url parameters that are needed in fetch_tile, create_thumbnail and download_thumbnail
    """
    url_template = tile_provider["url"]
    placeholders = extract_placeholders(url_template)

    # Placeholders handled explicitly by fetch_tile
    reserved = {"x", "y", "z", "s"}

    kwargs = {}

    for name in placeholders - reserved:
        if name in tile_provider and tile_provider[name] is not None:
            kwargs[name] = tile_provider[name]
            if name == "time" and tile_provider["time"] == "":
                kwargs["time"] = yesterday
        else:
            raise KeyError(
                f"Placeholder '{name}' not found in TileProvider '{tile_provider.get('name')}'"
            )
    return kwargs


def fetch_tile(url_template, x, y, z, s="a", **kwargs):
    """
    Fetch a tile from the given URL template.
    """
    try:
        url = url_template.format(x=x, y=y, z=z, s=s, **kwargs)
        response = requests.get(
            url,
            headers={"User-Agent": "JupyterGIS"},
            timeout=10,
        )
        response.raise_for_status()
        return Image.open(BytesIO(response.content))
    except RequestException as e:
        print(f"⚠️ Tile fetch failed: {e}")
        return None


def latlng_to_tile(lat, lng, zoom):
    """
    Convert latitude/longitude to tile coordinates.
    """
    tile = mercantile.tile(lng, lat, zoom, True)
    return tile.x, tile.y


def create_thumbnail(
    url_template,
    lat,
    lng,
    zoom,
    thumbnail_path,
    tile_size=256,
    thumbnail_size=(512, 512),
    **url_parameters,
):
    """
    Create a thumbnail for the specified location and zoom level.
    """
    # Skip if thumbnail already exists
    x, y = latlng_to_tile(lat, lng, zoom)

    # Fetch the tiles (2x2 grid for the thumbnail)
    tiles = []
    for dy in range(2):
        row = []
        for dx in range(2):
            tile_x, tile_y = x + dx, y + dy
            tile = fetch_tile(url_template, tile_x, tile_y, zoom, **url_parameters)
            if tile is None:
                tile = placeholder_tile((tile_size, tile_size))
            row.append(tile)
        tiles.append(row)

    # Create a blank image for the thumbnail
    thumbnail = Image.new("RGB", (2 * tile_size, 2 * tile_size))

    # Paste the tiles into the thumbnail image
    for dy, row in enumerate(tiles):
        for dx, tile in enumerate(row):
            thumbnail.paste(tile, (dx * tile_size, dy * tile_size))

    # Resize to the desired thumbnail size
    thumbnail = thumbnail.resize(thumbnail_size, Image.LANCZOS)
    return thumbnail


yesterday = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")

# San Francisco
# san_francisco = {"lat": 37.7749, "lng": -122.4194, "zoom": 5}

##middle_europe = {"lat": 48.63290858589535, "lng": -350.068359375, "zoom": 4}

# Default
# france = {"lat": 47.040182144806664, "lng": 1.2963867187500002, "zoom": 5}


def download_thumbnail(url_template, name, position, tile_size, **url_parameters):
    file_path = f"{THUMBNAILS_LOCATION}/{name}.png"
    if os.path.exists(file_path):
        return file_path
    thumbnail = create_thumbnail(
        url_template,
        position["lat"],
        position["lng"],
        position["zoom"],
        file_path,
        tile_size,
        **url_parameters,
    )
    thumbnail.save(file_path)
    return file_path


# Create thumbnail dir if needed
if not os.path.exists(THUMBNAILS_LOCATION):
    os.makedirs(THUMBNAILS_LOCATION)

# This is the JSON we'll generate for the gallery
provider_gallery = {}

custom_providers = providers.copy()

custom_providers["MacroStrat"] = {
    "CartoRaster": TileProvider(
        name="MacroStrat.CartoRaster",
        url="https://tiles.macrostrat.org/carto/{z}/{x}/{y}.png",
        attribution="© Geologic data © <a href=https://macrostrat.org>Macrostrat raster layer</a> (CC‑BY 4.0)",
        max_zoom=18,
    ),
    "CartoVector": TileProvider(
        name="MacroStrat.CartoVector",
        url="https://tiles.macrostrat.org/carto/{z}/{x}/{y}.mvt",
        attribution="© Geologic data © <a href=https://macrostrat.org>Macrostrat vector layer</a> (CC‑BY 4.0)",
        max_zoom=18,
    ),
}

# Fetch thumbnails and populate the dictionary
for provider_key, provider_value in provider_config.items():
    xyzprovider = custom_providers[provider_key]
    config_is_flat = "layerType" in provider_value
    xyz_is_flat = "url" in xyzprovider

    if config_is_flat and xyz_is_flat:
        tile_provider = xyzprovider

        url_template = tile_provider["url"]
        url_parameters = build_url_parameters(tile_provider)

        thumbnail_config = provider_value["thumbnail"]
        position = thumbnail_config["Special Rules"].get(
            provider_key, thumbnail_config["Default"]
        )
        tile_size = thumbnail_config.get("TileSize", 256)
        file_path = download_thumbnail(
            url_template, provider_key, position, tile_size, **url_parameters
        )

        provider_gallery[provider_key] = {
            "thumbnailPath": file_path,
            "name": provider_key,
            "layerType": provider_value["layerType"],
            "sourceType": provider_value["sourceType"],
            "sourceParameters": {
                "url": url_template,
                "attribution": xyzprovider.get("attribution"),
                "maxZoom": xyzprovider.get("max_zoom"),
                "minZoom": xyzprovider.get("min_zoom") or 0,
                "urlParameters": dict_keys_to_camel(url_template),
            },
            "layerParameters": {"opacity": 1},
        }

    elif config_is_flat and not xyz_is_flat:
        providers_maps = {}

        for map_name, tile_provider in xyzprovider.items():
            url_template = tile_provider["url"]
            url_parameters = build_url_parameters(tile_provider)

            thumbnail_config = provider_value["thumbnail"]
            position = thumbnail_config["Special Rules"].get(
                map_name, thumbnail_config["Default"]
            )
            tile_size = thumbnail_config.get("TileSize", 256)

            name = tile_provider["name"].replace(".", "-")

            file_path = download_thumbnail(
                url_template, name, position, tile_size, **url_parameters
            )

            providers_maps[map_name] = {
                "thumbnailPath": file_path,
                "name": provider_key + "." + map_name,
                "layerType": provider_value["layerType"],
                "sourceType": provider_value["sourceType"],
                "sourceParameters": {
                    "url": url_template,
                    "attribution": tile_provider.get("attribution"),
                    "maxZoom": tile_provider.get("max_zoom"),
                    "minZoom": tile_provider.get("min_zoom") or 0,
                    "urlParameters": dict_keys_to_camel(url_parameters),
                },
                "layerParameters": {"opacity": 1},
                "description": tile_provider.get("attribution"),
            }

        provider_gallery[provider_key] = providers_maps

    elif not config_is_flat and not xyz_is_flat:
        providers_maps = {}
        for map_name, map_config in provider_value.items():
            tile_provider = xyzprovider[map_name]
            url_template = tile_provider["url"]
            url_parameters = build_url_parameters(tile_provider)

            thumbnail_config = map_config["thumbnail"]
            position = thumbnail_config["Special Rules"].get(
                map_name, thumbnail_config["Default"]
            )
            tile_size = thumbnail_config.get("TileSize", 256)

            name = tile_provider["name"].replace(".", "-")

            file_path = download_thumbnail(
                url_template, name, position, tile_size, **url_parameters
            )

            providers_maps[map_name] = {
                "thumbnailPath": file_path,
                "name": provider_key + "." + map_name,
                "layerType": map_config["layerType"],
                "sourceType": map_config["sourceType"],
                "sourceParameters": {
                    "url": url_template,
                    "attribution": tile_provider.get("attribution"),
                    "maxZoom": tile_provider.get("max_zoom"),
                    "minZoom": tile_provider.get("min_zoom") or 0,
                    "urlParameters": dict_keys_to_camel(url_parameters),
                },
                "layerParameters": {"opacity": 1},
                "description": tile_provider.get("attribution"),
            }

        provider_gallery[provider_key] = providers_maps

    else:
        raise ValueError(f"Inconsistent config for provider '{provider_key}'")

"""
# compress each images of THUMBNAILS_LOCATION
cmd = f"shopt -s globstar && mogrify -resize 50% {THUMBNAILS_LOCATION}/*.png && optipng {THUMBNAILS_LOCATION}/*.png"
subprocess.run(["bash", "-lc", cmd], check=True)

try:
    subprocess.run(["bash", "-lc", cmd], check=True)
except subprocess.CalledProcessError as e:
    print("⚠️ Image compression skipped:", e)
"""

"""
# compress a single image of THUMBNAILS_LOCATION
image_name = "NaturalEarth-Countries.png"
cmd = (
    f'mogrify -resize 50% "{THUMBNAILS_LOCATION}/{image_name}" && '
    f'optipng "{THUMBNAILS_LOCATION}/{image_name}"'
)
subprocess.run(["bash", "-lc", cmd], check=True)
"""

with open(f"layer_gallery.json", "w") as f:
    json.dump(provider_gallery, f)
