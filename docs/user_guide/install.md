# Installation

It's always a good idea to use virtual environments.
Installing into a global environment can get you in trouble later!

These instructions presuppose that you know how to create and activate virtual
environments with your tool of choice.


## Installing the latest stable release

````{tab} Mamba (recommended)

:::{tip}
Installing with a conda-based tool (`mamba`, `conda`, `micromamba`, or `pixi`) lets you
install `qgis` alongside JupyterGIS, enabling `.qgz` file support.
QGIS is a C++ application and cannot be installed via `pip` or `uv`.
:::

## Mamba / Conda (recommended)

```bash
mamba install -c conda-forge jupytergis qgis
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
pip install jupytergis  # or jupytergis[tiler]!
```
````

Once JupyterGIS is installed, start JupyterLab:

```bash
jupyter lab
```

Or with `conda`:

```bash
conda install -c conda-forge jupytergis qgis
jupyter lab
```

## Pixi

Install into a project:

```bash
pixi add jupytergis qgis
pixi run jupyter lab
```

Or run directly without a permanent install:

```bash
pixi exec --spec jupytergis --spec qgis jupyter lab
```

## pip

:::{warning}
`.qgz` file support is not available — QGIS is not distributed on PyPI.
:::

```bash
pip install jupytergis
jupyter lab
```

## uv

:::{warning}
`.qgz` file support is not available — QGIS is not distributed on PyPI.
:::

Install into a project:

```bash
uv add jupytergis
uv run jupyter lab
```

Or run directly without a permanent install:

```bash
uv run --with jupytergis jupyter lab
```

## Docker

```bash
docker run -p 8888:8888 ghcr.io/geojupyter/jupytergis:latest
```

Docker build source: <https://github.com/geojupyter/jupytergis-docker>
