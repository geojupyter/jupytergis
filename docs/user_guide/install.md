(_install)=

## Installing JupyterGIS

:::{note}
It is best to install JupyterGIS using `mamba`, `conda`, `micromamba`, or `pixi` since you'll be able to install `qgis` at the same time, allowing you to open `.qgz` files.
:::

```bash
mamba install -c conda-forge jupytergis qgis
```

Alternatively, you can install JupyterGIS with `pip`:

```bash
pip install jupytergis
```

Finally, start JupyterLab:

```bash
jupyter lab
```


### Quickstart

Here are a few neat options to quickstart in a temporary environment:


#### [Docker](https://www.docker.com/)

```bash
docker run -p 8888:8888 ghcr.io/geojupyter/jupytergis:latest
```

#### [pixi](https://github.com/prefix-dev/pixi)

```bash
pixi exec --spec jupytergis --spec qgis jupyter lab
```


#### [uv](https://github.com/astral-sh/uv)

```bash
uv run --with jupytergis jupyter lab
```
