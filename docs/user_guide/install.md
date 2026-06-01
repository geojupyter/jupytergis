# Installation

## Mamba / Conda (recommended)

:::{note}
It is best to install JupyterGIS using `mamba`, `conda`, `micromamba`, or `pixi` since
you'll be able to install `qgis` at the same time, allowing you to open `.qgz` files.
:::

```bash
mamba install -c conda-forge jupytergis qgis
```

Once installed, launch JupyterLab:

```bash
jupyter lab
```

## pip

:::{warning}
When installing with `pip`, QGIS compatibility functions won't work out of the box.
You're on your own!
:::

```bash
pip install jupytergis
```

Once installed, launch JupyterLab:

```bash
jupyter lab
```

## Run without installing

These commands launch JupyterGIS directly without a permanent installation.

### Pixi

[Pixi](https://github.com/prefix-dev/pixi)

```bash
pixi exec --spec jupytergis --spec qgis jupyter lab
```

### uv

[uv](https://github.com/astral-sh/uv)

```bash
uv run --with jupytergis jupyter lab
```

### Docker

[Docker](https://www.docker.com/)

```bash
docker run -p 8888:8888 ghcr.io/geojupyter/jupytergis:latest
```

Docker build source: <https://github.com/geojupyter/jupytergis-docker>
