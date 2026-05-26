# JupyterGIS

JupyterGIS is an **in-browser, collaborative** Geographical Information System (GIS).
It is built on top of [Project Jupyter](https://jupyter.org) but independently useable.
As flagship project of the open [GeoJupyter community](https://geojupyter.org) it aims to enable organizations, researchers, students, anyone interested to easily explore, use and work with geospatial data.
We'd love to hear from you at a [community meeting](https://geojupyter.org/calendar.html)!

<a href="lite/lab/index.html" class="jgis-try-button">Try with JupyterLite</a>

```{note}
Backend-free JupyterGIS via JupyterLite runs entirely in the browser and does not support real-time collaboration.
```

## Highlights

- **Real-time collaboration** — like Google Docs or Miro for GIS, with spatial annotations and comments
- **QGIS interoperability** — import and export QGIS project files
- **Python API** — scriptable workflows in collaborative notebooks
- **Many data formats** — GeoJSON, GeoTIFF/COG, GeoParquet, GeoPackage, Shapefile, PMTiles, WMS/WMTS, and more
- **Grammar-driven symbology** — ultra-flexible rule-based styling, similar to Vega-Lite
- **Storymaps** — guided narratives through your maps
- **Hillshade & heatmaps** — terrain and density visualization
- **GDAL processing** — rasterize, warp, and translate directly in the browser or on the server
- **STAC & OpenEO** — cloud-native data catalog and processing support
- **Identify tool** — click features to inspect their properties
- **Layer gallery** — pre-built layer catalog for quick setup
- **Embeddable** — use as a standalone map, an IDE, or from within a notebook
- **AI skills** — integration with Jupyter & JupyterLite-AI. Map operations in natural language

```{image} ../jupytergis.png
:alt: JupyterGIS application
```

For more details, check out [About JupyterGIS](about/index.md).

```{toctree}
:maxdepth: 2
:caption: Documentation

about/gallery
about/index
getting_started/index
user_guide/index
contributor_guide/index
```

```{toctree}
:hidden:

changelog
```
