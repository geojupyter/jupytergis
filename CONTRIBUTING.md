# Contributing

## Development Install

> **Note**  
> You will need [Node.js](https://nodejs.org/) to build the extension package.  
> The `jlpm` command is JupyterLab's pinned version of [yarn](https://yarnpkg.com/) that is installed with JupyterLab.  
> You may use [yarn](https://yarnpkg.com/) or [npm](https://www.npmjs.com/) in lieu of `jlpm` below.

### Clone the Source

```bash
# Clone the repo to your local environment
git clone https://github.com/geojupyter/jupytergis.git

# Change directory to the jupytergis directory
cd jupytergis
```

### Create a Virtual Environment

#### Micromamba (Recommended)

```bash
# Create a virtual environment
micromamba create --name jupytergis_dev -c conda-forge pip "nodejs<22" qgis

# Activate it
micromamba activate jupytergis_dev
```

#### Plain Python

> **Note**  
> You may need to install some non-Python dependencies (e.g., QGIS, Node.js) separately when using this method.

```bash
# Create a virtual environment
python -m venv .venv

# Activate it
source .venv/bin/activate
```

### Install Dependencies and Build

```bash
# Install packages in development mode.
# WARNING: This step may hang indefinitely due to a bug in Nx. See troubleshooting below.
python scripts/dev-install.py

# Rebuild extension Typescript source after making changes
jlpm run build
```

> **Note**  
> By default, the `jlpm run build` command generates the source maps for this extension to make it easier to debug using the browser dev tools.  
> To also generate source maps for the JupyterLab core extensions, you can run the following command:

```bash
jupyter lab build --minimize=False
```

### Watch for Changes and Rebuild

You can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the extension.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
jlpm run watch

# Run JupyterLab in another terminal
jupyter lab
```

With the `watch` command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).

> **Note**  
> `jlpm run watch` will sit and wait for a change once started. Edit a file to trigger a build.

## Development Uninstall

```bash
pip uninstall jupytergis
```

In development mode, you will also need to remove the symlink created by the `jupyter labextension develop` command.  
To find its location, you can run `jupyter labextension list` to figure out where the `labextensions` folder is located. Then you can remove the symlink named `jupytergis` within that folder.

## Code Quality

We have several tools configured for checking code quality:

- **Pre-commit checks** run automatically at commit time.  
  Install checks with:

  ```bash
  pre-commit install
  ```

  Run them manually with:

  ```bash
  pre-commit run --all-files
  ```

  - `Ruff` formats and lints (sometimes autofixes) Python code.  
  - Generic pre-commit checks help avoid common mistakes like committing large files or trailing whitespace.

- **Package scripts** (defined in `package.json`) to check (and/or fix) TypeScript, JavaScript, CSS, JSON, Markdown, and YAML.  
  Run manually with:

  ```bash
  jlpm run lint
  ```

  - `Prettier` formats the file types listed above.  
  - `Eslint` lints (sometimes autofixes) JS/TS code.

## Troubleshooting

- **Setup of development environment hangs indefinitely** when running the `dev-install.py` step, specifically on the Yarn linking step.

  - This may be caused by having a `.gitignore` file in your home directory.  
    This is a [known issue with Nx](https://github.com/nrwl/nx/issues/27494).  
    The [only known workaround](https://github.com/nrwl/nx/issues/27494#issuecomment-2481207598) is to remove the `.gitignore` file from your home directory or to work in a location outside of the home directory tree.
