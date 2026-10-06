(document)=

# GISDocument

The `GISDocument` class is the main entry point for map creation and editing.

## Create a new ephemeral document with map view options

If you don't pass a filename as the first positional argument, the document will not be saved to disk.

```python
from jupytergis import GISDocument

doc = GISDocument(
    latitude=47.0,
    longitude=2.0,
    zoom=5,
    projection="EPSG:3857",
)
await doc.ready()

doc
```

## Open an existing document

It is possible to open an existing document and start editing it from the Python notebook.

The Python runtime then acts as a collaborator on the document (in the live collaboration sense), so other people can see the modifications being made to the document.

```python
from jupytergis import GISDocument

doc = GISDocument("mydocument.jGIS")
await doc.ready()

doc
```

If this document doesn't exist, it will be created on disk.

## Add base layers and vector/raster data

```python
from jupytergis import GISDocument, constant

doc = GISDocument()
await doc.ready()

doc.add_raster_layer(url="https://tile.openstreetmap.org/{z}/{x}/{y}.png")
doc.add_geojson_layer(
    name="Ship Trajectories",
    path="https://openlayers.org/en/latest/examples/data/geojson/ship-trajectories.json",
    symbology=[constant("red").encoding("stroke")],
)
doc.add_geotiff_layer(
    name="Sentinel-2 cloudless",
    url="https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/36/Q/WD/2020/7/S2A_36QWD_20200701_0_L2A/TCI.tif",
)

doc
```

## Add GeoJSON from in-memory data

```python
from jupytergis import GISDocument, constant

latitude = 48.853757
longitude = 2.358213

doc = GISDocument(zoom=12, latitude=latitude, longitude=longitude)
await doc.ready()

geojson = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [longitude, latitude]},
            "properties": {"name": "Paris", "mag": 4.2},
        },
    ],
}

doc.add_geojson_layer(
    name="Paris",
    data=geojson,
    symbology=[
        constant("blue").encoding("stroke"),
        constant("red").encoding("fill"),
        constant(3).encoding("circle-stroke-width"),
        constant(20).encoding("radius"),
    ],
)

doc
```

## Image and Video overlays

```python
from jupytergis import GISDocument

doc = GISDocument(zoom=5, latitude=46.431742, longitude=1.792230)
await doc.ready()

doc.add_image_layer(
    name="GeoJupyter logo",
    url="https://geojupyter.org/assets/images/logo.png",
    coordinates=[
        [-5.0, 51.0],
        [8.0, 51.0],
        [8.0, 42.0],
        [-5.0, 42.0],
    ],
)

doc
```

## Vector tiles

```python
from jupytergis import GISDocument, constant

doc = GISDocument(zoom=8, latitude=41.928500, longitude=-87.828527)
await doc.ready()

doc.add_vectortile_layer(
    name="Buildings",
    url="https://planetarycomputer.microsoft.com/api/data/v1/vector/collections/ms-buildings/tilesets/global-footprints/tiles/{z}/{x}/{y}",
    symbology=[constant("lightblue").encoding("stroke")],
)

doc
```

## WMS

```python
from jupytergis import GISDocument

doc = GISDocument(zoom=8, latitude=41.928500, longitude=-87.828527)
await doc.ready()

# Utility function to find available layers
layers = doc.get_wms_available_layers("https://ows.terrestris.de/osm/service")

doc.add_wms_tile_layer(
    url="https://ows.terrestris.de/osm/service",
    layer_name=layers[0]["name"],
    name="WMS layer",
)

doc
```

## OpenEO tile layers

JupyterGIS supports OpenEO tile layers as long as you can connect to a local or remote tile server that supports OpenEO.

Follow this guide to spawn a OpenEO tile server locally on your machine: https://sentinel-hub.github.io/titiler-openeo/local-setup/#environment-setup

```python
# graph is an OpenEO DataCube graph (see the `openeo` Python library)
doc.add_openeo_tile_layer(
    graph,
    name="OpenEO tiles",
    opacity=0.9,
)
```

## GeoParquet

```python
from jupytergis import GISDocument, constant

doc = GISDocument(zoom=2, latitude=58.118086, longitude=-98.799263)
await doc.ready()

doc.add_geoparquet_layer(
    path="https://raw.githubusercontent.com/opengeospatial/geoparquet/main/examples/example.parquet",
    name="Parquet example",
    symbology=[
        constant("blue").encoding("stroke"),
        constant("lightblue").encoding("fill"),
    ],
)

doc
```

## GeoPackage

```python
from jupytergis import GISDocument, constant

doc = GISDocument(zoom=4, latitude=45.895322, longitude=2.267552)
await doc.ready()

doc.add_geopackage_vector_layer(
    path="https://raw.githubusercontent.com/richard-thomas/ol-load-geopackage/master/examples/dist/Natural_Earth_QGIS_layers_and_styles.gpkg",
    name="Geopackage example",
    table_names=["Countries", "Rivers + Lake Centrelines"],
    symbology=[
        constant("blue").encoding("stroke"),
        constant("green").encoding("fill"),
    ],
)

doc
```

## Story maps

A story map walks the reader through a map one segment at a time. Each segment is a map view (a center and a zoom) plus optional markdown and an image. A document holds a single story, which is created for you the first time you add a segment.

```python
from jupytergis import GISDocument

doc = GISDocument(zoom=5, latitude=47.0, longitude=2.0)
await doc.ready()

doc.add_raster_layer(url="https://tile.openstreetmap.org/{z}/{x}/{y}.png")

doc.add_story_segment(
    name="Paris",
    center=(2.358213, 48.853757),
    zoom=12,
    markdown="# Paris\n\nWhere the story starts.",
)
doc.add_story_segment(
    name="Marseille",
    center=(5.369780, 43.296482),
    zoom=11,
    markdown="## Marseille\n\nDown to the Mediterranean.",
    transition="smooth",
    transition_time=2,
)

doc
```

`center` is a `(longitude, latitude)` pair, and defaults to the current map center. Pass a `[west, south, east, north]` bounding box as `extent` instead if that is what you have. Open the story panel in the map toolbar to present it.

Use `create_story` first when you want to set the title or the presentation colors:

```python
doc.create_story(
    title="A tour of France",
    story_type="Vertical Scroll",
    presentation_bg_color="#101820",
    presentation_text_color="#f2f2f2",
)
```

`update_story` changes those later, and properties you leave out keep their value:

```python
doc.update_story(title="A short tour of France", story_panel_opacity=0.8)

print(doc.story)  # the story properties
print(doc.story_segments)  # segment ids, in presentation order
```

A segment can also override how other layers are drawn while it is on screen:

```python
quakes = doc.add_geojson_layer(name="Quakes", path="quakes.geojson")

doc.add_story_segment(
    name="Only the quakes",
    center=(2.0, 47.0),
    zoom=6,
    layer_overrides=[{"targetLayer": quakes, "visible": True, "opacity": 0.5}],
)
```

Segments are layers, so `doc.remove_layer(segment_id)` removes one and drops it from the story.

## Remove layers and inspect document content

```python
layer_id = doc.add_raster_layer(url="https://tile.openstreetmap.org/{z}/{x}/{y}.png")

doc.remove_layer(layer_id)
```

You can also inspect convenience properties:

```python
print(doc.layers)  # dict keyed by layer id
print(doc.layer_tree)  # ordered layer ids / groups
```

## Open in a sidecar

This opens the map next to the notebook in a new JupyterLab tab

```python
doc.sidecar(title="Map", anchor="split-right")
```
