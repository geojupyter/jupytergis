(how-to-layer-metadata)=

# Inspect a Layer's Projection, Extent and Bands

Before you can symbolize, filter or reproject data with confidence, it helps to know
what the data actually is: which {term}`Coordinate Reference System` it is stored in,
what area it covers, how many {term}`bands <band>` it has and what range of values those
bands hold.

JupyterGIS reports all of this in the **Metadata** tab of the Layer Properties
dialog.

## Open the Metadata tab

Right-click a layer in the **Layers** panel and choose **Layer Metadata**.

You can also open **Layer Properties** (by right-clicking the layer, or by
double-clicking it) and switch to the **Metadata** tab.

:::{note}
Metadata is read when you open the tab, not when you select the layer. For a remote
file this means a short pause the first time while JupyterGIS reads the file's header.
:::

## What you will see

Which sections appear depends on what the data format is able to tell us.

**General** — the layer's name, the layer and source types, and where the data is loaded
from.

**Coordinate reference system** — the EPSG code the data is stored in, its name, its
units, and its proj4 definition. The code links to [epsg.io](https://epsg.io), where
you can read a full description of the projection.

:::{note}
JupyterGIS does not bundle a projection database, so a well-known-text (WKT) definition
is only shown when the file itself carries one. The EPSG code and proj4 string are
enough to identify the {term}`Coordinate Reference System` unambiguously.
:::

**Extent** — the bounding box of the data, given both in the data's own coordinate
reference system and in `EPSG:4326` longitude/latitude. Where JupyterGIS could not read
an extent from the data itself, it falls back to the extent the layer occupies on the
map and says so.

**Features** — for vector layers: how many features there are, which geometry types they
use, and the columns of the attribute table with their types.

**Bands** — for raster layers: one row per {term}`band`, with its data type, its
{term}`no data value` and its range of values. This is the quickest way to find the
numbers you need when configuring symbology.

:::{note}
Not every raster stores band statistics. When they are missing, JupyterGIS estimates the
range from a downsampled overview and tells you it has done so; for a very large file
with no overviews it reports no range at all rather than downloading the whole raster.
:::

**Tile pyramid** — the reduced-resolution copies stored inside the file (the overviews
that make a GeoTIFF a [Cloud-Optimized GeoTIFF](https://cogeo.org)), or, for a tiled web
service, the range of zoom levels it serves.

## Supported formats

GeoTIFF, GeoZarr, GeoJSON, shapefiles, GeoParquet, XYZ raster tiles, vector tiles and
WMS are read in detail.

Any other source type still shows its General section and the extent JupyterGIS computed
when it drew the layer.
