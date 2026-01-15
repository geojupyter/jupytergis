from datetime import date, timedelta
import json
from io import BytesIO
import os

import requests
from PIL import Image
import mercantile
from xyzservices import providers, TileProvider

THUMBNAILS_LOCATION = "layer_gallery"


def fetch_tile(url_template, x, y, z, s="a"):
    """
    Fetch a tile from the given URL template.
    """
    url = url_template.format(x=x, y=y, z=z, s=s)
    # print(f"   Fetch {url}")
    response = requests.get(
        url, headers={"Content-Type": "application/json", "User-Agent": "JupyterGIS"}
    )
    response.raise_for_status()
    return Image.open(BytesIO(response.content))


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
):
    """
    Create a thumbnail for the specified location and zoom level.
    """
    # Skip if thumbnail already exists
    if os.path.exists(thumbnail_path):
        return Image.open(thumbnail_path)
    x, y = latlng_to_tile(lat, lng, zoom)

    # Fetch the tiles (2x2 grid for the thumbnail)
    tiles = []
    for dy in range(2):
        row = []
        for dx in range(2):
            tile_x, tile_y = x + dx, y + dy
            tile = fetch_tile(url_template, tile_x, tile_y, zoom)
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
san_francisco = {"lat": 37.7749, "lng": -122.4194, "zoom": 5}

middle_europe = {"lat": 48.63290858589535, "lng": -350.068359375, "zoom": 4}

# Default
france = {"lat": 47.040182144806664, "lng": 1.2963867187500002, "zoom": 5}

providers_types = {
    "OpenStreetMap": {"layerType": "RasterLayer", "sourceType": "RasterSource"},
    "NASAGIBS": {"layerType": "RasterLayer", "sourceType": "RasterSource"},
    "USGS": {"layerType": "RasterLayer", "sourceType": "RasterSource"},
    "WaymarkedTrails": {"layerType": "RasterLayer", "sourceType": "RasterSource"},
    "Gaode": {"layerType": "RasterLayer", "sourceType": "RasterSource"},
    "Strava": {"layerType": "RasterLayer", "sourceType": "RasterSource"},
    "OPNVKarte": {"layerType": "RasterLayer", "sourceType": "RasterSource"},
    "OpenTopoMap": {"layerType": "RasterLayer", "sourceType": "RasterSource"},
    "OpenRailwayMap": {"layerType": "RasterLayer", "sourceType": "RasterSource"},
    "Esri": {"layerType": "RasterLayer", "sourceType": "RasterSource"},
    "MacroStrat": {
        "CartoRaster": {"layerType": "RasterLayer", "sourceType": "RasterSource"},
        "CartoRaster": {"layerType": "RasterLayer", "sourceType": "RasterSource"},
        "CartoVector": {
            "layerType": "VectorTileLayer",
            "sourceType": "VectorTileSource",
        },
    },
}

thumbnails_providers_positions = {
    "OpenStreetMap": {
        "Special Rules": {
            "BZH": {"lat": 47.76702233051035, "lng": -3.4675598144531254, "zoom": 8},
            "CH": {"lat": 46.8182, "lng": 8.2275, "zoom": 8},
            "DE": {"lat": 51.1657, "lng": 10.4515, "zoom": 8},
            "France": france,
            "HOT": france,
        },
        "Default": france,
    },
    "NASAGIBS": {"Special Rules": {}, "Default": france},
    # 'JusticeMap': {
    #     'Special Rules': {},
    #     'Default': san_francisco,
    # },
    "USGS": {
        "Special Rules": {},
        "Default": san_francisco,
    },
    "WaymarkedTrails": {
        "Special Rules": {},
        "Default": france,
    },
    "Gaode": {
        "Special Rules": {},
        "Default": san_francisco,
    },
    "Strava": {"Special Rules": {}, "Default": france, "TileSize": 512},
    "OPNVKarte": {
        "Special Rules": {},
        "Default": san_francisco,
    },
    "OpenTopoMap": {
        "Special Rules": {},
        "Default": san_francisco,
    },
    "OpenRailwayMap": {"Special Rules": {}, "Default": san_francisco, "TileSize": 512},
    # 'OpenFireMap': {
    #     'Special Rules': {},
    #     'Default': san_francisco,
    # },
    # 'SafeCast': {
    #     'Special Rules': {},
    #     'Default': san_francisco,
    # },
    "Esri": {
        "Special Rules": {},
        "Default": san_francisco,
    },
    "MacroStrat": {
        "Special Rules": {
            "CartoRaster": france,
            "CartoVector": france,
        },
        "Default": france,
    },
}


def download_thumbnail(url_template, name, position, tile_size):
    file_path = f"{THUMBNAILS_LOCATION}/{name}.png"
    thumbnail = create_thumbnail(
        url_template,
        position["lat"],
        position["lng"],
        position["zoom"],
        file_path,
        tile_size,
    )
    thumbnail.save(file_path)
    return file_path


def get_layer_types(provider, map_name=None):
    """
    Returns (layerType, sourceType) or (None, None)
    """
    # print("get_layer_types is called")
    print("provider:", provider)
    if provider not in providers_types:
        return None, None

    provider_entry = providers_types[provider]
    print("provider_entry:", provider_entry)

    if "layerType" in provider_entry:
        print("layerType is:", provider_entry["layerType"])
        return (
            provider_entry["layerType"],
            provider_entry["sourceType"],
        )

    if map_name and map_name in provider_entry:
        print("layerType is:", provider_entry[map_name]["layerType"])
        return (
            provider_entry[map_name]["layerType"],
            provider_entry[map_name]["sourceType"],
        )

    return None, None


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
for provider in thumbnails_providers_positions.keys():
    xyzprovider = custom_providers[provider]

    if "url" in xyzprovider.keys():
        print(f"Process {provider}")

        try:
            name = provider
            url_template = xyzprovider["url"]

            if name in thumbnails_providers_positions[provider]["Special Rules"].keys():
                position = thumbnails_providers_positions[provider]["Special Rules"][
                    name
                ]
            else:
                position = thumbnails_providers_positions[provider]["Default"]

            tile_size = thumbnails_providers_positions[provider].get("TileSize", 256)

            file_path = download_thumbnail(url_template, name, position, tile_size)

            layer_type, source_type = get_layer_types(provider)

            provider_gallery[name] = {
                "thumbnailPath": file_path,
                "layerType": layer_type,
                "sourceType": source_type,
                **xyzprovider,
            }

            if "time" in provider_gallery[name]:
                provider_gallery[name]["time"] = yesterday

        except Exception as e:
            print("Failed...", e)

        continue

    providers_maps = {}
    for map_name in xyzprovider.keys():
        # print(f"Process {provider} {map_name}")

        try:
            if (
                map_name
                in thumbnails_providers_positions[provider]["Special Rules"].keys()
            ):
                position = thumbnails_providers_positions[provider]["Special Rules"][
                    map_name
                ]
            else:
                position = thumbnails_providers_positions[provider]["Default"]

            tile_provider = xyzprovider[map_name]
            # print('tileprovider url:', tile_provider["url"])
            url_template = tile_provider["url"]

            if "crs" in tile_provider or "apikey" in tile_provider:
                # TODO Support other projections once we have another viewer than maplibre
                # TODO Support api keys
                continue

            name = tile_provider["name"].replace(".", "-")

            tile_size = thumbnails_providers_positions[provider].get("TileSize", 256)

            file_path = download_thumbnail(url_template, name, position, tile_size)
            layer_type, source_type = get_layer_types(provider, map_name)

            providers_maps[map_name] = {
                "thumbnailPath": file_path,
                "layerType": layer_type,
                "sourceType": source_type,
                **tile_provider,
            }
            if "time" in providers_maps[map_name]:
                providers_maps[map_name]["time"] = yesterday

            provider_gallery[provider] = providers_maps

        except Exception as e:
            print("Failed...", e)

# Save JSON repr
with open(f"{THUMBNAILS_LOCATION}/layer_gallery.json", "w") as f:
    json.dump(provider_gallery, f)
