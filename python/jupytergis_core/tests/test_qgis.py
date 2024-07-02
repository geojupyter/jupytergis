from pathlib import Path

from jupytergis_core.qgis import import_project_from_qgis

from dirty_equals import IsPartialDict, IsStr


FILES = Path(__file__).parent / "files"


def test_qgis():
    jgis_layer_tree = import_project_from_qgis(FILES / "project0.qgs")
    source_id0 = IsStr()
    source_id1 = IsStr()
    source_id2 = IsStr()
    source_id3 = IsStr()
    assert jgis_layer_tree == IsPartialDict(
        layers={
            "_02b1b4d5_316b_4f4d_9c38_16bf10a3bcb8": {
                "name": "OpenStreetMap0",
                "parameters": {
                    "source": source_id0,
                },
                "type": "RasterLayer",
                "visible": True,
            },
            "_097deeeb_6564_48d1_a3be_1caa4d93382f": {
                "name": "OpenStreetMap1",
                "parameters": {
                    "source": source_id1,
                },
                "type": "RasterLayer",
                "visible": True,
            },
            "_bccce044_998d_45f9_bf6b_fe1472681cc3": {
                "name": "OpenStreetMap2",
                "parameters": {
                    "source": source_id2,
                },
                "type": "RasterLayer",
                "visible": True,
            },
            "_32a77a2c_1756_4876_9f99_e3c7b702f86a": {
                "name": "OpenStreetMap3",
                "parameters": {
                    "source": source_id3,
                },
                "type": "RasterLayer",
                "visible": True,
            },
        },
        layerTree=[
            "_097deeeb_6564_48d1_a3be_1caa4d93382f",
            "_02b1b4d5_316b_4f4d_9c38_16bf10a3bcb8",
            {
                "layers": [
                    "_32a77a2c_1756_4876_9f99_e3c7b702f86a",
                    "_bccce044_998d_45f9_bf6b_fe1472681cc3",
                ],
                "name": "group0",
            },
        ]
    )
    assert jgis_layer_tree == IsPartialDict(
        sources={
            source_id0.value: {
                "name": "OpenStreetMap0",
                "type": "RasterLayer",
                "parameters": {
                    "url": "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                    "maxZoom": 19,
                    "minZoom": 0,
                },
            },
            source_id1.value: {
                "name": "OpenStreetMap1",
                "type": "RasterLayer",
                "parameters": {
                    "url": "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                    "maxZoom": 19,
                    "minZoom": 0,
                },
            },
            source_id2.value: {
                "name": "OpenStreetMap2",
                "type": "RasterLayer",
                "parameters": {
                    "url": "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                    "maxZoom": 19,
                    "minZoom": 0,
                },
            },
            source_id3.value: {
                "name": "OpenStreetMap3",
                "type": "RasterLayer",
                "parameters": {
                    "url": "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                    "maxZoom": 19,
                    "minZoom": 0,
                },
            },
        },
    )
