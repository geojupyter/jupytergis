# Add to the layer gallery

Edit **`scripts/layer_gallery/config.py`**. This is the only file you need to touch.

The `gallery` dict is structured as `gallery[category][layer_id] = LayerEntry(...)`.
Category keys become the tab labels in the gallery UI.

## If your layer is in the xyzservices catalog

Use `XYZServicesRef` to point at an existing entry in the
[xyzservices catalog](https://xyzservices.readthedocs.io/en/stable/introduction.html):

```python
from models import LayerEntry, ThumbnailConfig, XYZServicesRef

gallery = {
    ...
    "OpenStreetMap": {
        ...
        "MyNewLayer": LayerEntry(
            name="OpenStreetMap.MyNewLayer",
            layer_type="RasterLayer",
            source_type="RasterSource",
            xyzservices=XYZServicesRef(provider="OpenStreetMap", layer="MyNewLayer"),
            thumbnail=ThumbnailConfig(lat=47.04, lng=1.30, zoom=5),
        ),
    },
}
```

The layer gallery generator script (`/scripts/layer_gallery/`) fills in the URL,
attribution, and zoom levels from `xyzservices` at build time.

## If your layer is not in the xyzservices catalog

Use `TileProvider` from the `xyzservices` library to specify parameters directly:

```python
from xyzservices import TileProvider
from models import LayerEntry, ThumbnailConfig

gallery = {
    ...
    "MyProvider": {
        "MyLayer": LayerEntry(
            name="MyProvider.MyLayer",
            layer_type="RasterLayer",
            source_type="RasterSource",
            tile_provider=TileProvider(
                name="MyProvider.MyLayer",
                url="https://tiles.example.com/{z}/{x}/{y}.png",
                attribution="© My Provider",
                max_zoom=18,
            ),
            thumbnail=ThumbnailConfig(lat=47.04, lng=1.30, zoom=5),
        ),
    },
}
```

For URLs with template variables beyond `{z}/{x}/{y}` (e.g. `{variant}`), add them as
extra kwargs to `TileProvider`. They become `urlParameters` in the output JSON.

## Specify a layer and source type

The layer and source types that JupyterGIS will use to add these layers to the map.

For raster tile layers, use `layer_type="RasterLayer"` and `source_type="RasterSource"`.

For vector tile layers, use `layer_type="VectorTileLayer"` and `source_type="VectorTileSource"`.

## Add a thumbnail

Thumbnails live in `packages/base/layer_gallery_thumbnails/` and are committed to the repo.

### Generate automatically (raster tile layers)

```bash
python scripts/layer_gallery/generate.py --thumbnails
```

This fetches tiles, stitches a 256×256 PNG, and optimizes it. Commit the result.

### Create manually (GeoJSON / vector layers, or custom screenshots)

Save a 256×256 PNG to:

```
packages/base/layer_gallery_thumbnails/<Name>.png
```

where `<Name>` is `entry.name` with the first `.` replaced by `-`.
For example, `NaturalEarth.Coastlines110m` → `NaturalEarth-Coastlines110m.png`.

Optimize this `png` with `optipng`.

Commit the file.

## Verify

```bash
python scripts/layer_gallery/generate.py
```

This runs automatically at build time.
It fails with a listing of missing thumbnail paths, and does not write
`packages/base/_generated/layer_gallery.json` until all thumbnails are present.
