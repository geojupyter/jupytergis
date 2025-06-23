# Architecture overview

JupyterGIS is a JupyterLab extension (based on the structure defined by
[jupyterlab/extensions-cookiecutter-ts](https://github.com/jupyterlab/extension-cookiecutter-ts)).

Its architecture is based on QuantStack's
[JupyterCAD](https://github.com/jupytercad/JupyterCAD) architecture.

## JupyterLab

### About Lumino and JupyterLab

JupyterGIS is a JupyterLab extension. It may be useful to read more about the
[extensions developer documentation](https://jupyterlab.readthedocs.io/en/latest/extension/extension_dev.html).

The [Lumino](https://lumino.readthedocs.io/en/latest/api/index.html) library is a
framework used to control the UI - i.e., tracks what changes in the UI and how it should
react to that change.

## JupyterGIS components and structure

JupyterGIS is a monorepo containing TypeScript and Python packages.

### TypeScript packages

TypeScript packages live in the `packages/` directory.

If you change anything about TypeScript packages, you'll need to rebuild with `jlpm run
build`.

### `@jupytergis/base`

This package contains everything that controls the map using
[OpenLayers](https://openlayers.org/doc/), panels, buttons, dialogs; all as
[React](https://react.dev/) components.
It is a UI library, collection of tools - but it does not do anything by itself.
We use this package to make the JupyterLab extension.

- Defines the map view. See `packages/base/src/mainview`.
- Generates the layer gallery. See
  `packages/base/rasterlayer_gallery_generator.py`.
- Defines "commands" that appear in various GUI menus and the command pallette
  (`CTRL+SHIFT+C`).
  See `packages/base/src/commands/`.
  - Defines the toolbar and associated commands.
    See `packages/base/src/toolbar/widget.tsx`.
- Generates forms from the schema package.
  See `packages/base/src/formbuilder/`.
- Contains all logic related to adding layers and reading data.

### `@jupytergis/schema`

Defines our `.jgis` file format - as JSON schemas.
The source of truth for data structures in JupyterGIS.
If you wish to add a new layer _type_, you would need to add it to the schema.

Python classes and Typescript types are automatically generated from the schema at
build-time (i.e. not commited to the repository) using
[`json2ts`](https://github.com/GregorBiswanger/json2ts) for TypeScript,
and
[`datamodel-code-generator`](https://docs.pydantic.dev/latest/integrations/datamodel_code_generator/)
for Python.

- Forms: Generated from e.g. `schema/src/schema/project/layers/vectorlayer.json`
- Project file / shared model: `schema/src/schema/project/jgis.json`

### Python packages

Python packages live in the `python/` directory.
These Python packages may include some TypeScript as well.

- `jupytergis`: A metapackage including `jupytergis_core`, `jupytergis_lab`,
  `jupytergis_qgis`, `jupyter-collaboration`, and `jupyterlab`.
- `jupytergis_lite`: A metapackage including `jupytergis_core` and `jupytergis_lab`.
  For deployment and testing of JupyterGIS in JupyterLite.
- `jupytergis_core`: Gets the UI to do things - e.g., load / create JupyterGIS files,
  and work with them.
  Also includes a server endpoint for saving the created `.jgis` files to disk (not used
  in JupyterLite).
- `jupytergis_lab`: Contains everything needed for JupyterGIS to work within a notebook,
  **the Python API**, the notebook renderer (the part that displays the JupyterGIS
  session in the notebook).
  **Might be worth considering renaming this folder? Current name doesn't reflect what
  it does**.
- `jupytergis_qgis`: Enables importing and exporting QGIS project files.
  Requires a server component, and currently is not used in JupyterLite.

### "Model"

Structure is defined in schema `packages/schema/src/schema/project/jgis.json`.

#### Shared model

All collaborators share this and listen for changes to this.
It mediates changes with Conflict-free Replicated Data Types (CRDTs), which is handled
by `yjs`.
It is the "magic sauce" that enables collaboration!

:::tip
You can view the shared model in many contexts by writing
`console.log(model.sharedModel)` in a TypeScript file!
:::

### Commands

Many new features are a matter of defining a new command.

### Forms

JupyterGIS uses automatically generated forms for creating/editing layers and
more.

Those forms are generated from schema definitions, meaning that adding a new
entry in the schema will automatically create user-facing UI components when
editing layers.

An example of this was [adding a new "interpolate" parameter for raster
sources](https://github.com/geojupyter/jupytergis/pull/522/files), the only
required changes were to add the new schema entry, and react on the
"interpolate" value in the OpenLayers viewer.

Many forms are generated from `BaseForm` (the default form implementation), but
some forms use other classes which extend `BaseForm` in order to provide more
advanced controls.
Each of these classes accepts the relevant schema as a property in order to
generate the form on-the-fly. The correct form class is selected in
`formselector.ts`.

### Map view

JupyterGIS uses [OpenLayers](https://openlayers.org/doc/) as a rendering engine.

The action happens in the `@jupytergis/base` package, at
`packages/base/src/mainview/mainView.tsx`.

#### Swappable rendering engine?

The Venn Diagram of the JavaScript map rendering engine ecosystem unfortunately looks
like a bunch of disparate circles with few overlaps.
The burden of understanding this is very high, and we hope to avoid shifting
this burden on to our users.

For example, OpenLayers has excellent support for alternative map projections and
low-level API, but lacks support for visualizing huge vector datasets with the
GPU.
DeckGL can quickly render huge datasets, but lacks projection support.
