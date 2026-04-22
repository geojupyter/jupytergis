import pytest

from layer_gallery.models import LayerEntry, XYZServicesRef


class TestXYZServicesRef:
    def test_xyzservicesref_resolve(self) -> None:
        resolved = XYZServicesRef(["OpenStreetMap", "Mapnik"]).resolve()
        assert resolved.url == "https://tile.openstreetmap.org/{z}/{x}/{y}.png"


class TestLayerEntry:
    @pytest.mark.parametrize(
        ("input_name", "expected"),
        [
            ("openstreetmap.mapnik", "openstreetmap-mapnik.png"),
            ("OPNVKarte", "OPNVKarte.png"),
            ("NASAGIBS.ModisTerra.Extra", "NASAGIBS-ModisTerra-Extra.png"),
        ],
    )
    def test_thumbnail_filename(self, input_name: str, expected: str) -> None:
        actual = LayerEntry._thumbnail_filename(input_name)
        assert actual == expected
