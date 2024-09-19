import os
from enum import Enum
from urllib.parse import urljoin
import requests
import mapbox_vector_tile


class MESSAGE_ACTION(str, Enum):
    CONNECT_ROOM = "connect_room"
    DISCONNECT_ROOM = "disconnect_room"


def multi_urljoin(*parts) -> str:
    if len(parts) == 0:
        return ""
    return urljoin(
        parts[0],
        "/".join(part for part in parts[1:]),
    )


def normalize_path(path: str) -> str:
    if os.path.isabs(path):
        return path
    else:
        return os.path.abspath(os.path.join(os.getcwd(), path))


def get_source_layer_names(tile_url):
    # Fetch a sample tile (e.g., z=0, x=0, y=0)
    sample_tile_url = tile_url.format(z=0, x=0, y=0)
    response = requests.get(sample_tile_url)
    response.raise_for_status()

    tile_data = response.content
    tile = mapbox_vector_tile.decode(tile_data)

    layer_names = list(tile.keys())

    if len(layer_names) != 0:
        return layer_names
    else:
        raise ValueError("No layer found in the tile")
