# Installation

:::{important}
It's always a good idea to use virtual environments.
Installing into a global environment can get you in trouble later!

These instructions presuppose that you know how to create and activate virtual
environments with your tool of choice.
:::

## Installing the latest stable release

````{tab} Mamba (recommended)

:::{tip}
Installing with a conda-based tool (`mamba`, `conda`, `micromamba`, or `pixi`) lets you
install `qgis` alongside JupyterGIS, enabling `.qgz` file support.
QGIS is a C++ application and cannot be installed via `pip` or `uv`.
:::

```bash
mamba install -c conda-forge jupytergis qgis
jupyter lab  # Start JupyterLab!
```
````

````{tab} pip

:::{warning}
When installing with `pip`, QGIS compatibility and optional tiler functions won't work out of the box.
You may especially run in to problems with Python 3.14, for which [many geospatial
libraries still lack wheels as of May 2026](https://github.com/Toblerity/Fiona/issues/1504).
You're on your own!
:::

```bash
pip install jupytergis
jupyter lab  # Start JupyterLab!
```
````

````{tab} Pixi

:::{tip}
Installing with a conda-based tool (`mamba`, `conda`, `micromamba`, or `pixi`) lets you
install `qgis` alongside JupyterGIS, enabling `.qgz` file support.
QGIS is a C++ application and cannot be installed via `pip` or `uv`.
:::

Install into a project:

```bash
pixi add jupytergis qgis
pixi run jupyter lab  # Start JupyterLab!
```

Or run directly without a permanent install:

```bash
pixi exec --spec jupytergis --spec qgis jupyter lab
```

````

````{tab} uv

:::{warning}
When installing with `pip`, QGIS compatibility and optional tiler functions won't work out of the box.
You may especially run in to problems with Python 3.14, for which [many geospatial
libraries still lack wheels as of May 2026](https://github.com/Toblerity/Fiona/issues/1504).
You're on your own!
:::

Install into a project:

```bash
uv add jupytergis
uv run jupyter lab  # Start JupyterLab!
```

Or run directly without a permanent install:

```bash
uv run --with jupytergis jupyter lab
```
````

````{tab} Docker

```bash
docker run -p 8888:8888 ghcr.io/geojupyter/jupytergis:latest
```

Docker build source: <https://github.com/geojupyter/jupytergis-docker>
````

## Installing dynamic tiling functionality

To use dynamic tiling functionality, you'll need our "tiler" optional dependencies.

For any of the above commands, replace `jupytergis` with `jupytergis[tiler]` (for
pip/uv) or `jupytergis-tiler` (for conda/mamba/pixi).

:::{note}
This functionality is available as of version `0.16.0`.
:::

## Installing a pre-release

To install a pre-release, replace install commands shown above with these examples.
Changes include:

- Specify a pre-release version exactly; here's we're using pre-release `0.16.0a4` as an
  example.
- When installing a Conda package with mamba/conda/pixi, add the pre-release channel as
  highest priority channel.
- When installing a PyPI package with pip/uv, add a flag to allow installing
  pre-releases.

````{tab} Mamba (recommended)
```bash
mamba install \
  --channel conda-forge/label/jupytergis_prerelease \
  --channel conda-forge \
  jupytergis==0.16.0a4 qgis
jupyter lab  # Start JupyterLab!
```
````

````{tab} pip
```bash
pip install --pre jupytergis==0.16.0a4
jupyter lab  # Start JupyterLab!
```
````

````{tab} Pixi
Without a permanent install:

```bash
pixi exec \
  --channel conda-forge/label/jupytergis_prerelease \
  --channel conda-forge \
  --spec jupytergis==0.16.0a4 \
  --spec qgis \
  jupyter lab
```

````

````{tab} uv
Without a permanent install:

```bash
uv run --prerelease=allow --with jupytergis==0.16.0a4 jupyter lab
```
````
