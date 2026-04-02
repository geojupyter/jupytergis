# Add to the layer gallery


## Add a new entry to the config file

First, edit `packages/base/layer_gallery.json` to add a new entry.

The top level keys are layer provider IDs (shown as tabs at the top of the gallery), and
the 2nd level keys are the ids of the layers.

Layers are represented as objects, values of the 2nd-level keys. E.g.
`OpenStreetmap.Mapnik`:

```json
{
  "OpenStreetMap": {
    "Mapnik": {
      "thumbnailPath": "layer_gallery/OpenStreetMap-Mapnik.png",
      "name": "OpenStreetMap.Mapnik",
      "layerType": "RasterLayer",
      "sourceType": "RasterSource",
      "sourceParameters": {
        "url": "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        "attribution": "(C) OpenStreetMap contributors",
        "maxZoom": 19,
        "minZoom": 0,
        "urlParameters": {}
      },
      "layerParameters": { "opacity": 1 },
      "description": "(C) OpenStreetMap contributors"
    },
    // ...
```

Follow established conventions in this file, and if it makes sense, start by copying an
existing entry.


### `xyzservices`

[`xyzservices`](https://github.com/geopandas/xyzservices) is used under the hood for
thumbnail generation.
For simplicity, if your layer exists in `xyzservices` ensure the provider and
layer name match what's in `xyzservices`.

If it's not in `xyzservices` you may need to edit `layer_gallery_generator.py` and
extend `custom_providers` following the existing examples in that file.


## Add a thumbnail

### Generate

The `packages/base/layer_gallery_generator.py` script can automatically generate
thumbnails for you.

You'll first need to configure the `packages/base/layer_gallery/thumbnail_config.json`.
This is arranged similarly to the `layer_gallery.json` file but exclusively includes
thumbnail config.
It may be easiest to start by copying an existing thumbnail configuration.

Finally you can execute:

```bash
python packages/base/layer_gallery_generator.py
```

Once this is done, you'll need to resize the thumbnail(s), as the script outputs in
512x512, but we want 256x256:

```bash
mogrify -resize 50% /path/to/thumbnail.png
```

Don't forget to optimize! Read on.


### Manual

You have the option to manually create a thumbnail.

Take a screenshot and crop or otherwise resize it to 256x256 pixels and save as a PNG.

Don't forget to optimize! Read on.


### Optimizing

Whether you generate thumbnails automatically or create them manually, we'll need to
optimize them for filesize before committing.

```bash
optipng "/path/to/thumbnail.png"
```
