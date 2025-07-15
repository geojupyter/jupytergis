import base64
import sqlite3
import uuid
from enum import Enum
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import Request, urlopen


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


def isURL(path: str) -> bool:
    return path.startswith("http://") or path.startswith("https://")


def download_file(url: str, ext:str) -> str:
    filename = f"downloaded_{uuid.uuid4().hex[:8]}.{ext}"

    req = Request(url, headers={"User-Agent": "python-urllib"})
    with urlopen(req) as resp, open(filename, "wb") as out:
        out.write(resp.read())

    return filename


def get_gpkg_layers(gpkg_path: str) -> list[str]:
    if isURL(gpkg_path):
        gpkg_path = download_file(gpkg_path, "gpkg")

    conn = sqlite3.connect(gpkg_path)
    cursor = conn.cursor()
    cursor.execute("""SELECT table_name FROM gpkg_contents WHERE data_type = 'features'""")
    layers = [row[0] for row in cursor.fetchall()]
    conn.close()
    return layers


def file_to_data_url(path: str, mime:str=None) -> str:
    p = Path(path)

    if mime is None:
        mime = "application/octet-stream"

    data = p.read_bytes()
    b64 = base64.b64encode(data).decode("ascii")

    return f"data:{mime};base64,{b64}"