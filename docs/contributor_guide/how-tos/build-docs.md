# Build the documentation

The documentation is built with [Sphinx](https://www.sphinx-doc.org/) using the
[PyData Sphinx Theme](https://pydata-sphinx-theme.readthedocs.io/).
It also includes a [JupyterLite](https://jupyterlite.readthedocs.io/) build
so users can try JupyterGIS directly from the docs.

## Prerequisites

The docs build requires JupyterGIS to be built first:

```bash
jlpm install
jlpm build
jlpm build:packages
```

## Create the docs environment

```bash
micromamba env create -n jupytergis-docs -f docs/environment-docs.yml
```

## Build

From the repository root:

```bash
micromamba run -n jupytergis-docs docs/build.sh
```

The output will be in `docs/_build/html/`. Open `docs/_build/html/index.html` in a
browser to preview.

## Incremental rebuilds

On subsequent builds, `docs/clean.sh` is called automatically to remove stale
JupyterLite artifacts. The rest of the Sphinx build is incremental.

To do a full clean rebuild:

```bash
rm -rf docs/_build
micromamba run -n jupytergis-docs docs/build.sh
```

## Common issues

- **`examples/.ipynb_checkpoints` exists**: The JupyterLite build will fail.
  Remove it with `rm -rf examples/.ipynb_checkpoints`.
  The build script checks for this and will tell you.
