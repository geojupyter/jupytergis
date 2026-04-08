from io import BytesIO
from unittest import mock

from PIL import Image
from xyzservices import TileProvider

from models import GeoJSONLayer, LayerEntry, ThumbnailConfig, XYZServicesRef


def make_raster_entry(name="Esri.WorldGrayCanvas", use_xyz=True):
    thumb = ThumbnailConfig(lat=37.77, lng=-122.42, zoom=5)
    if use_xyz:
        return LayerEntry(
            name=name,
            layer_type="RasterLayer",
            source_type="RasterSource",
            data_source=XYZServicesRef(["Esri", "WorldGrayCanvas"]),
            thumbnail=thumb,
        )
    return LayerEntry(
        name=name,
        layer_type="RasterLayer",
        source_type="RasterSource",
        data_source=TileProvider(
            name=name,
            url="https://example.com/{z}/{x}/{y}.png",
            attribution="Test",
            max_zoom=18,
        ),
        thumbnail=thumb,
    )


def make_geojson_entry():
    return LayerEntry(
        name="NaturalEarth.Coastlines110m",
        layer_type="VectorLayer",
        source_type="GeoJSONSource",
        data_source=GeoJSONLayer(
            path="https://example.com/data.geojson",
            attribution="Example",
        ),
        layer_parameters={"opacity": 1, "color": {"stroke-color": "#fff"}},
        thumbnail=ThumbnailConfig(lat=47.04, lng=1.30, zoom=5),
    )


def fake_tile_response(color=(100, 150, 200)):
    img = Image.new("RGB", (256, 256), color)
    buf = BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    mock_resp = mock.MagicMock()
    mock_resp.content = buf.read()
    mock_resp.raise_for_status = mock.MagicMock()
    return mock_resp
