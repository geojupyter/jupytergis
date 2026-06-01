# Installation

:::{tip}
Installing with a conda-based tool (`mamba`, `conda`, `micromamba`, or `pixi`) lets you
install `qgis` alongside JupyterGIS, enabling `.qgz` file support.
QGIS is a C++ application and only available as a conda-forge package — it cannot be
installed via `pip` or `uv`.
:::

## Mamba / Conda (recommended)

```bash
mamba install -c conda-forge jupytergis qgis
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
