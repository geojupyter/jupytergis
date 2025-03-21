# Development setup

## Development install

```{eval-rst}
.. note::

    You will need `Node.js <https://nodejs.org/>`_ to build the extension package.

    The ``jlpm`` command is JupyterLab's pinned version of
    `yarn <https://yarnpkg.com/>`__ that is installed with JupyterLab. You may use
    `yarn <https://yarnpkg.com/>`__ or `npm <https://www.npmjs.com/>`_ in lieu of ``jlpm`` below.

```

### Clone the source

```bash
# Clone the repo to your local environment
git clone https://github.com/geojupyter/jupytergis.git

# Change directory to the jupytergis directory
cd jupytergis
```

### Create a virtual environment

```{eval-rst}
.. tabs::

    .. tab:: Micromamba (recommended)

        .. code-block:: bash

            # Create a virtual environment
            micromamba create --name jupytergis_dev -c conda-forge pip "nodejs<22" qgis

            # Activate it
            micromamba activate jupytergis_dev


    .. tab:: Plain python

        .. note::

            You may need to install some non-Python dependencies (e.g. QGIS,
            Node.js) separately when using this method.


        .. code-block:: bash

            # Create a virtual environment
            python -m venv .venv

            # Activate it
            source .venv/bin/activate

```

### Install dependencies and build

```bash
# Install packages in development mode.
# WARNING: This step may hang indefinitely due to a bug in Nx. See
#          troubleshooting below.
python scripts/dev-install.py

# Rebuild extension Typescript source after making changes
jlpm run build
```

```{eval-rst}
.. note::

    By default, the ``jlpm run build`` command generates the source maps for this extension to make it easier to debug using the browser dev tools.
    To also generate source maps for the JupyterLab core extensions, you can run the following command:

    .. code-block:: bash

        jupyter lab build --minimize=False

```

### Watch for changes and rebuild

You can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the extension.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
jlpm run watch

# Run JupyterLab in another terminal
jupyter lab
```

With the watch command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).

```{eval-rst}
.. note::

   ``jlpm run watch`` will sit and wait for a change once started. Edit a file
   to trigger a build.

```

## Development uninstall

```bash
pip uninstall jupytergis
```

In development mode, you will also need to remove the symlink created by `jupyter labextension develop` command. To find its location, you can run `jupyter labextension list` to figure out where the `labextensions` folder is located. Then you can remove the symlink named `jupytergis` within that folder.
