(symbology)=

# Symbology examples

## Symbology on `add_geojson_layer`

```python
from jupytergis import GISDocument, constant

doc = GISDocument()
await doc.ready()
doc.add_raster_layer(url="https://tile.openstreetmap.org/{z}/{x}/{y}.png")

doc.add_geojson_layer(
    path="data/france_regions.geojson",
    symbology=[
        constant("green").encoding("fill"),
        constant("white").encoding("stroke"),
    ],
)
doc
```

```python
from jupytergis import GISDocument, field, ClassificationMode

doc = GISDocument()
await doc.ready()
doc.add_geojson_layer(
    path="data/eq.geojson",
    symbology=[
        field("mag").encoding("radius"),
        field("felt").colormap(
            "viridis",
            domain=[1, 9000],
            mode=ClassificationMode.LOGARITHMIC,
            n_shades=10
        ).encoding("fill"),
    ],
)

doc
```

```python
from jupytergis import GISDocument, constant, field, when

doc = GISDocument()
await doc.ready()
doc.add_geojson_layer(
    path="data/eq.geojson",
    symbology=[
        field("mag").encoding("radius"),
        when(field("mag") >= 8).constant("red").encoding("fill"),
        when(field("mag") < 8, field("mag") > 3)
            .constant("orange")
            .encoding("fill"),
        when(field("mag") <= 3).constant("green").encoding("fill"),
    ],
)

doc
```

```python
from jupytergis import GISDocument, constant, field, vega_expr

doc = GISDocument()
await doc.ready()

doc.add_raster_layer(url="https://tile.openstreetmap.org/{z}/{x}/{y}.png")

doc.add_geojson_layer(
    path="data/eq.geojson",
    symbology=[
        field("mag").encoding("radius"),
        vega_expr(
            "datum.mag > 7 ? 'red' : "
            "datum.mag > 5 ? 'orange' : "
            "datum.mag > 4 ? 'yellow' : "
            "datum.mag > 3 ? 'cyan' : 'pink'",
        ).encoding("fill"),
        constant("green").encoding("stroke"),
    ],
)

doc
```

```python
from jupytergis import GISDocument, constant, python_expr

doc = GISDocument()
await doc.ready()

doc.add_raster_layer(url="https://tile.openstreetmap.org/{z}/{x}/{y}.png")


doc.add_geojson_layer(
    path="data/france_regions.geojson",
    symbology=[
        python_expr(
            "'purple' if datum.code > 80 else"
            "'red' if datum.code > 60 else"
            "'green' if datum.code > 40 else"
            "'cyan' if datum.code > 20 else 'gray'",
        ).encoding("fill"),
        constant("black").encoding("stroke"),
    ],
)
doc
```

```python
from jupytergis import GISDocument, field

doc = GISDocument()
await doc.ready()
doc.add_geojson_layer(
    path="https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_roads.geojson",
    symbology=[field("type").categorical(colormap="schemeDark2").encoding("stroke")],
)

doc
```

## Symbology on `add_geotiff_layer`

```python
from jupytergis import GISDocument, field

doc = GISDocument(latitude=16.731087, longitude=33.278505, zoom=9)
await doc.ready()

doc.add_raster_layer(url="https://tile.openstreetmap.org/{z}/{x}/{y}.png")

doc.add_geotiff_layer(
    url="https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/36/Q/WD/2020/7/S2A_36QWD_20200701_0_L2A/TCI.tif",
    symbology=[
        field("$band-1")
        .scalar(domain=(0, 0.5), output_range=(0, 1))
        .encoding("pixel-alpha"),
        field("$band-2").colormap("winter", n_shades=9).encoding("pixel-rgb"),
    ],
)
doc
```

```python
from jupytergis import GISDocument, field

doc = GISDocument()
await doc.ready()

doc.add_raster_layer(url="https://tile.openstreetmap.org/{z}/{x}/{y}.png")

doc.add_geotiff_layer(
    url="https://eoresults.esa.int/d/FCM-AGB-100m/2023/01/01/FCM-AGB-100m-2023/FCM_Europe_demo_2023_AGB.tif",
    symbology=[
        field("$band-1")
        .scalar(domain=(0, 233), output_range=(4, 20))
        .encoding("pixel-red", "pixel-green", "pixel-blue", "pixel-alpha"),
    ],
    normalize=False,
)

doc
```

```python
from jupytergis import GISDocument, constant, field

doc = GISDocument()
await doc.ready()
doc.add_raster_layer(url="https://tile.openstreetmap.org/{z}/{x}/{y}.png")

doc.add_geotiff_layer(
    url="https://eoresults.esa.int/d/FCM-AGB-100m/2023/01/01/FCM-AGB-100m-2023/FCM_Europe_demo_2023_AGB.tif",
    symbology=[
        constant(0).encoding("pixel-red"),
        field("$band-1").scalar(domain=[0, 233], output_range=[0, 25]).encoding("pixel-green"),
        constant(0).encoding("pixel-blue"),
        field("$band-1").identity().encoding("pixel-alpha"),
    ],
    normalize=False
)

doc
```

## Symbology on `add_vectortile_layer`

```python
from jupytergis import GISDocument, field

doc = GISDocument()
await doc.ready()
doc.add_geojson_layer(
    path="https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_roads.geojson",
    symbology=[field("type").categorical(colormap="schemeDark2").encoding("stroke")],
)

doc
```

## Additional symbology recipes

Constant numeric encoding mapping:

```python
from jupytergis import constant

symbology = [constant(3).encoding("radius")]
```

Categorical mapping:

```python
from jupytergis import field

symbology = [field("landuse").categorical(colormap="schemeSet1").encoding("fill")]
```

Scalar mapping:

```python
from jupytergis import field

symbology = [field("population").scalar(domain=[0, 1_000_000], output_range=[2, 15]).encoding("radius")]
```

Heatmap and clustering preprocessors as separate symbology layers:

```python
from jupytergis import cluster, constant, field, heatmap

heat = heatmap(radius=20, blur=30, mappings=[field("$density").colormap("hot").encoding("pixel-rgb")])
clusters = cluster(radius=40, mappings=[constant("black").encoding("stroke")])

symbology = [heat, clusters]
```

(encoding-values)=

## Allowed `encoding` values

The `encoding` method accepts either a single `VisualEncoding`
value or a list of `VisualEncoding` values.

String literals shown below are the corresponding enum values.

Supported direct visual encodings, corresponding to [OpenLayers flat style](https://openlayers.org/en/latest/apidoc/module-ol_style_flat.html):

- `fill-color`
- `stroke-color`
- `circle-fill-color`
- `circle-stroke-color`
- `pixel-color`
- `fill-red`
- `fill-green`
- `fill-blue`
- `pixel-red`
- `pixel-green`
- `pixel-blue`
- `fill-alpha`
- `pixel-alpha`
- `pixel-rgb`
- `stroke-width`
- `circle-radius`
- `circle-stroke-width`

Supported shortcuts:

- `fill` expands to `fill-color` and `circle-fill-color`
- `stroke` expands to `stroke-color` and `circle-stroke-color`
- `radius` expands to `circle-radius`
- `circle-fill` expands to `circle-fill-color`
- `circle-stroke` expands to `circle-stroke-color`
