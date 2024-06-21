from datetime import date, timedelta
import json
from io import BytesIO

import requests
from PIL import Image
import mercantile
from xyzservices import providers

THUMBNAILS_LOCATION = "rasterlayer_gallery"


def fetch_tile(url_template, x, y, z, s='a'):
    """
    Fetch a tile from the given URL template.
    """
    url = url_template.format(x=x, y=y, z=z, s=s)
    print(f'   Fetch {url}')
    response = requests.get(url, headers={
        "Content-Type": "application/json",
        "User-Agent": "JupyterGIS"
    })
    response.raise_for_status()
    return Image.open(BytesIO(response.content))

def latlng_to_tile(lat, lng, zoom):
    """
    Convert latitude/longitude to tile coordinates.
    """
    tile = mercantile.tile(lng, lat, zoom, True)
    return tile.x, tile.y

def create_thumbnail(url_template, lat, lng, zoom, tile_size=256, thumbnail_size=(512, 512)):
    """
    Create a thumbnail for the specified location and zoom level.
    """
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
    thumbnail = Image.new('RGB', (2 * tile_size, 2 * tile_size))

    # Paste the tiles into the thumbnail image
    for dy, row in enumerate(tiles):
        for dx, tile in enumerate(row):
            thumbnail.paste(tile, (dx * tile_size, dy * tile_size))

    # Resize to the desired thumbnail size
    thumbnail = thumbnail.resize(thumbnail_size, Image.LANCZOS)
    return thumbnail


yesterday = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")

# San Francisco
san_francisco = {
    'lat': 37.7749,
    'lng': -122.4194,
    'zoom': 5
}

middle_europe = {
    'lat': 48.63290858589535,
    'lng': -350.068359375,
    'zoom': 4
}

# Default
france = {
    'lat': 47.040182144806664,
    'lng': 1.2963867187500002,
    'zoom': 5
}

thumbnails_providers_positions = {
    'OpenStreetMap': {
        'Special Rules': {
            'BZH': {
                'lat': 47.76702233051035,
                'lng': -3.4675598144531254,
                'zoom': 8
            },
            'CH': {
                'lat': 46.8182,
                'lng': 8.2275,
                'zoom': 8
            },
            'DE': {
                'lat': 51.1657,
                'lng': 10.4515,
                'zoom': 8
            },
            'France': france,
            'HOT': france
        },
        'Default': france
    },
    'NASAGIBS': {
        'Special Rules': {},
        'Default': france
    },
    # 'JusticeMap': {
    #     'Special Rules': {},
    #     'Default': san_francisco,
    # },
    'USGS': {
        'Special Rules': {},
        'Default': san_francisco,
    },
    'WaymarkedTrails': {
        'Special Rules': {},
        'Default': france,
    },
    'Gaode': {
        'Special Rules': {},
        'Default': san_francisco,
    },
    'Strava': {
        'Special Rules': {},
        'Default': france,
        'TileSize': 512
    },
    'OPNVKarte': {
        'Special Rules': {},
        'Default': san_francisco,
    },
    'OpenTopoMap': {
        'Special Rules': {},
        'Default': san_francisco,
    },
    'OpenRailwayMap': {
        'Special Rules': {},
        'Default': san_francisco,
        'TileSize': 512
    },
    # 'OpenFireMap': {
    #     'Special Rules': {},
    #     'Default': san_francisco,
    # },
    # 'SafeCast': {
    #     'Special Rules': {},
    #     'Default': san_francisco,
    # }
}

def download_thumbnail(url_template, name, position, tile_size):
    file_path = f'{THUMBNAILS_LOCATION}/{name}.png'
    thumbnail = create_thumbnail(
        url_template,
        position['lat'],
        position['lng'],
        position['zoom'],
        tile_size
    )
    thumbnail.save(file_path)
    return file_path


# This is the JSON we'll generate for the raster gallery
raster_provider_gallery = {}

# Fetch thumbnails and populate the dictionary
for provider in thumbnails_providers_positions.keys():
    xyzprovider = providers[provider]

    if 'url' in xyzprovider.keys():
        print(f"Process {provider}")

        name = provider
        url_template = xyzprovider["url"]

        if name in thumbnails_providers_positions[provider]['Special Rules'].keys():
            position = thumbnails_providers_positions[provider]['Special Rules'][name]
        else:
            position = thumbnails_providers_positions[provider]['Default']

        tile_size = thumbnails_providers_positions[provider].get('TileSize', 256)

        file_path = download_thumbnail(url_template, name, position, tile_size)
        raster_provider_gallery[name] = dict(
            name=name,
            thumbnailPath=file_path,
            attrs=xyzprovider
        )

        continue

    for map_name in xyzprovider.keys():
        print(f"Process {provider} {map_name}")

        try:
            if map_name in thumbnails_providers_positions[provider]['Special Rules'].keys():
                position = thumbnails_providers_positions[provider]['Special Rules'][map_name]
            else:
                position = thumbnails_providers_positions[provider]['Default']

            tile_provider = xyzprovider[map_name]

            if 'crs' in tile_provider or 'apikey' in tile_provider:
                # TODO Support other projections once we have another viewer than maplibre
                # TODO Support api keys
                continue

            name = tile_provider["name"].replace(".", "-")
            url_template = tile_provider.build_url(time=yesterday)
            tile_size = thumbnails_providers_positions[provider].get('TileSize', 256)

            file_path = download_thumbnail(url_template, name, position, tile_size)
            raster_provider_gallery[name] = dict(
                name=name,
                thumbnailPath=file_path,
                attrs=tile_provider
            )

        except Exception as e:
            print('Failed...', e)

# Save JSON repr
with open(f'{THUMBNAILS_LOCATION}/raster_layer_gallery.json', 'w') as f:
    json.dump(raster_provider_gallery, f)
