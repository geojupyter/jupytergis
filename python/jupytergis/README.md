<p align="center"><img width="100" src="https://raw.githubusercontent.com/geojupyter/jupytergis/main/packages/base/style/icons/logo.svg"></p>
<p align="center"><sub>Logo by <a href="https://github.com/IsabelParedes">Isabel Paredes</a></sub></p>
<h1 align="center">JupyterGIS</h1>
<p align="center"><strong>In-browser, collaborative GIS built on Jupyter</strong></p>

[![lite-badge]][lite] [![docs-badge]][docs] [![jupytergis-badge]][marketplace]

[lite-badge]: https://jupyterlite.rtfd.io/en/latest/_static/badge.svg
[lite]: https://jupytergis.readthedocs.io/en/latest/lite/lab/index.html?path=france_hiking.jGIS/
[docs-badge]: https://readthedocs.org/projects/jupytergis/badge/?version=latest
[docs]: https://jupytergis.readthedocs.io
[jupytergis-badge]: https://labextensions.dev/api/badge/jupytergis?metric=downloads&leftColor=%23555&rightColor=%23F37620&style=flat
[marketplace]: https://labextensions.dev/extensions/jupytergis

JupyterGIS is an in-browser Geographical Information System (GIS) with real-time
collaboration. It is built on [Project Jupyter](https://jupyter.org) but independently
useable. As flagship project of the [GeoJupyter community](https://geojupyter.org) it
aims to enable organizations, researchers, and students to easily explore and work with
geospatial data.

![jupytergis](https://raw.githubusercontent.com/geojupyter/jupytergis/main/jupytergis.png)

## Highlights

- **Real-time collaboration** — like Google Docs for GIS, with spatial annotations and comments
- **QGIS interoperability** — import and export QGIS project files
- **Python API** — scriptable workflows in collaborative notebooks
- **Many data formats** — GeoJSON, GeoTIFF/COG, GeoParquet, GeoPackage, Shapefile, PMTiles, WMS/WMTS, and more
- **Grammar-driven symbology** — flexible rule-based styling, similar to Vega-Lite
- **Storymaps** — guided narratives through your maps
- **Hillshade & heatmaps** — terrain and density visualization
- **GDAL processing** — rasterize, warp, and translate in the browser or on the server
- **STAC & OpenEO** — cloud-native data catalog and processing support
- **Pangeo integration** — dynamic raster tile serving via [TiTiler](https://developmentseed.org/titiler/) backed by the Pangeo stack
- **Layer gallery** — pre-built layer catalog for quick setup
- **Embeddable** — use as a standalone map, an IDE, or from within a notebook
- **AI skills** — map operations in natural language via Jupyter AI

## Try it now

### [In your browser with JupyterLite](https://jupytergis.readthedocs.io/en/latest/lite/lab/index.html?path=france_hiking.jGIS/)

Runs entirely in your browser via WebAssembly — no installation needed.

> **Note:** Real-time collaboration is not yet supported in JupyterLite.

### [On Notebook.link](https://notebook.link/github/geojupyter/jupytergis/lab/?path=examples%2Ffrance_hiking.jGIS)

Powered by [Notebook.link](https://notebook.link) and [JupyterLite](https://jupyterlite.readthedocs.io/).

## Installation

### Mamba (recommended)

```bash
mamba install -c conda-forge jupytergis
```

### pip

```bash
pip install jupytergis
```

### Pixi

```bash
pixi add jupytergis
```

### Docker

```bash
docker run -p 8888:8888 ghcr.io/geojupyter/jupytergis:latest
```

Docker build source: <https://github.com/geojupyter/jupytergis-docker>

## Deploying with JupyterLite

You can run JupyterGIS entirely in the browser using JupyterLite:

1. Create a repository using the [xeus-lite-demo](https://github.com/jupyterlite/xeus-lite-demo) template.
2. Edit `environment.yml` and add `jupytergis-lite`.
3. Add your data and `.jGIS` files under the `content/` directory.
4. Under _Settings → Pages_ set the GitHub Pages deployment **source** to "GitHub Actions".

> **Note:** Collaboration is not yet supported in JupyterLite static deployments.

## Documentation

https://jupytergis.readthedocs.io

## Contributing

We welcome contributions! Check out the [Contributor Guide](https://jupytergis.readthedocs.io/en/latest/contributor_guide/index.html) to get started.

Chat with us on [Zulip](https://jupyter.zulipchat.com/#narrow/channel/471314-geojupyter) or join a [community meeting](https://geojupyter.org/calendar.html).

## License

BSD 3-Clause. See [LICENSE](./LICENSE).
