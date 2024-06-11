import os
from enum import Enum
from urllib.parse import urljoin


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
