## Contributing

### Development Install

**Note:** You will need [Node.js](https://nodejs.org/) to build the extension package and ensure
`UV` is installed on your the instructions at system. You can install `UV` by following
[UV Installation Guide](https://docs.astral.sh/uv/configuration/installer/).

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

```bash
# Clone the repo to your local environment
git clone https://github.com/geojupyter/jupytergis.git

# Change directory to the jupytergis directory
cd jupytergis

# Install the package in development mode using UV
uv run python scripts/dev-install.py
```

The above will:

1. Create a virtual environment.
2. Install all dependencies.
3. Build and install the JupyterLab extensions.

### Notes on Using UV

**Important Note:** With `UV`, you do not need to manually activate the virtual environment or
handle dependency management. Simply ensure `UV` is installed on your system by following the instructions at
[UV Installation Guide](https://docs.astral.sh/uv/configuration/installer/).

All commands can be prefixed with `uv run`, and `UV` will handle activating the virtual environment for you. If
you would like to activate the virtual environment manually, you can run `source .venv/bin/activate` on Unix-based
systems or `source .venv/Scripts/activate` on Windows. Then, you will be able to run commands without the `uv run`
prefix.

### Watching Source Files and Running JupyterLab

You can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the extension.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
uv run jlpm run watch

# Alternatively, you can run the following after each TypeScript code change
uv run jlpm run build:dev

# Run JupyterLab in another terminal
uv run jupyter lab
```

With the watch command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).

By default, the `jlpm run build` command generates the source maps for this extension to make it easier to debug using the browser dev tools. To also generate source maps for the JupyterLab core extensions, you can run the following command:

```bash
uv run jupyter lab build --minimize=False
```

### Development Uninstall

```bash
uv run pip uninstall jupytergis
```

In development mode, you will also need to remove the symlink created by `jupyter labextension develop`
command. To find its location, you can run `jupyter labextension list` to figure out where the `labextensions`
folder is located. Then you can remove the symlink named `jupytergis` within that folder.

### Packaging the Extension

See [RELEASE](RELEASE.md)
