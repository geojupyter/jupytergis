from unittest import mock

from xyzservices import TileProvider

from models import LayerEntry, ThumbnailConfig
from thumbnail import generate_thumbnail

from .helpers import fake_tile_response


class TestGenerateThumbnail:
    def test_generate_thumbnail_creates_256x256_png(self) -> None:
        entry = LayerEntry(
            name="Test",
            layer_type="RasterLayer",
            source_type="RasterSource",
            data_source=TileProvider(
                name="Test",
                url="https://example.com/{z}/{x}/{y}.png",
                attribution="Test",
                max_zoom=18,
            ),
            thumbnail=ThumbnailConfig(lat=47.04, lng=1.30, zoom=5),
        )

        with mock.patch("requests.get", return_value=fake_tile_response()):
            thumbnail = generate_thumbnail(entry=entry)

        assert thumbnail is not None
        assert thumbnail.size == (256, 256)
