(_install)=

## Installing JupyterGIS

It is best to install JupyterGIS using `mamba` or `conda`, since you'll be able to install `qgis` as well, allowing you to open `.qgz` files.

```bash
mamba install -c conda-forge jupytergis qgis
```

Alternatively, you can install JupyterGIS with `pip`:

```bash
pip install jupytergis
```

Or you can run JupyterGIS from a Docker image:

```bash
docker run -p 8888:8888 ghcr.io/geojupyter/jupytergis:latest
```
