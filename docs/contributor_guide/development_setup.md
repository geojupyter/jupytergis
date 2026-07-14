# Development setup

:::{admonition} Do I need a development environment?
:class: hint, dropdown

You only need to set up a development environment if you plan to **change
JupyterGIS itself** — fixing a bug, adding a feature, or editing these docs
locally. If you just want to *use* JupyterGIS, you can skip everything below
and install the released package by following the {doc}`../getting_started/index`.
:::

## Development install

:::{note}
You will need [`Node.js`](https://nodejs.org/) to build the extension package.

The `jlpm` command is JupyterLab's pinned version of
[`yarn`](https://yarnpkg.com) that is installed with JupyterLab. You may use
[`yarn`](https://yarnpkg.com) or [`npm`](https://www.npmjs.com) in lieu of `jlpm` below.
:::

### Clone the source

```bash
# Clone the repo to your local environment
git clone https://github.com/geojupyter/jupytergis.git

# Change directory to the jupytergis directory
cd jupytergis
```

### Create a virtual environment

:::{admonition} What is a virtual environment, and why use one?
:class: hint, dropdown

A virtual environment is an isolated space for this project's dependencies, so
the versions JupyterGIS needs (Python, Node.js, QGIS) don't clash with other
projects on your machine — and vice versa. The Micromamba option below sets one
up for you.
:::

````{tab} Micromamba (Recommended)
```{note}
Micromamba is a lightweight package manager compatible with conda environments.
It is recommended for setting up the JupyterGIS development environment. If you don’t have it installed, please follow the official documentation: [Micromamba Installation Guide](https://mamba.readthedocs.io/en/latest/installation/micromamba-installation.html)
```

```bash
# Create a virtual environment

micromamba create --name jupytergis_dev -c conda-forge pip "python=3.13.*" "nodejs=24" qgis

# Activate it
micromamba activate jupytergis_dev
````

````{tab} Plain python
```{note}
You may need to install some non-Python dependencies (e.g. QGIS,
Node.js) separately when using this method.
```

```bash
# Create a virtual environment
python -m venv .venv

# Activate it
source .venv/bin/activate
```
````

### Install dependencies and build

```bash
# Install packages in development mode.
# WARNING: This step may hang indefinitely due to a bug in Nx. See
#          troubleshooting below.
python scripts/dev-install.py

# Rebuild extension Typescript source after making changes
jlpm run build
```

:::{note}
By default, the `jlpm run build` command generates the source maps for this extension to make it easier to debug using the browser dev tools.
To also generate source maps for the JupyterLab core extensions, you can run the following command:

```bash
jupyter lab build --minimize=False
```

:::

### Watch for changes and rebuild

You can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the extension.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
jlpm run watch

# Run JupyterLab in another terminal
jupyter lab
```

With the watch command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).

:::{note}
`jlpm run watch` will sit and wait for a change once started. Edit a file to trigger a build.
:::

## Development uninstall

```bash
pip uninstall jupytergis
```

In development mode, you will also need to remove the symlink created by `jupyter labextension develop` command. To find its location, you can run `jupyter labextension list` to figure out where the `labextensions` folder is located. Then you can remove the symlink named `jupytergis` within that folder.
