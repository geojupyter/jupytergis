# Feature store: PostGIS and tipg

A feature store layer draws two things, an overlay of current features kept in the JupyterGIS document, and a folded baseline stored in a PostGIS table. [tipg](https://github.com/developmentseed/tipg) serves that baseline as vector tiles. Jupyter proxies those tiles, so the browser never talks to tipg directly.

You need both containers for the baseline tiles and for **Fold to Feature Store**. The Edit Features button creates a feature-store layer only when `JGIS_POSTGIS_URL` is set. Otherwise it creates an inline GeoJSON layer.

## Containers

Run this from any directory. JupyterLab on the host reaches PostGIS and tipg through the published ports. tipg reaches PostGIS on the Docker network.

```bash
docker network create jgis-feature-store

docker run -d --name jgis-postgis \
  --network jgis-feature-store \
  -p 5432:5432 \
  -e POSTGRES_USER=jupytergis \
  -e POSTGRES_PASSWORD=jupytergis \
  -e POSTGRES_DB=jupytergis \
  postgis/postgis:16-3.4

docker run -d --name jgis-tipg \
  --network jgis-feature-store \
  -p 8081:80 \
  -e DATABASE_URL=postgresql://jupytergis:jupytergis@jgis-postgis:5432/jupytergis \
  -e TIPG_DEBUG=true \
  ghcr.io/developmentseed/tipg:latest
```

`TIPG_DEBUG=true` turns on `GET /refresh`. After a fold, Jupyter calls that so tipg picks up the new `jgis_store_*` table.

Check tipg:

```bash
curl -s http://127.0.0.1:8081/collections | head
```

## JupyterLab

Install the PostgreSQL client (`psql`) on the machine that runs JupyterLab. Fold shells out to it.

Start Lab with:

```bash
export JGIS_POSTGIS_URL=postgresql://jupytergis:jupytergis@127.0.0.1:5432/jupytergis
export JGIS_TIPG_URL=http://127.0.0.1:8081
jupyter lab
```

## What shows up in PostGIS

Fold creates one table per store in the `public` schema:

`public.jgis_store_<slug>`

A UUID store id becomes 32 hex characters with the dashes removed. The table has `id`, `geom` (geometry, SRID 4326), `props`, `updated_at`, and `updated_by`. tipg serves it as the collection `public.jgis_store_<slug>`.

Until the first fold, that table does not exist, so baseline tiles are empty. Overlay edits stay in the document either way.
