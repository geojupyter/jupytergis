# Architecture overview

JupyterGIS is a JupyterLab extension (based on the structure defined by
[jupyterlab/extensions-cookiecutter-ts](https://github.com/jupyterlab/extension-cookiecutter-ts).

Its architecture is based on QuantStack's
[JupyterCAD](https://github.com/QuantStack/JupyterCAD) architecture.


## JupyterLab

### Backbone

...


## JupyterGIS components

### Directory structure

JupyterGIS is a monorepo containing TypeScript and Python packages.

* `python/`: The Python packages! These may include some TypeScript as well (_TODO: why?
  Link to JupyterLab extension doc?_).
  * `jupytergis`: A metapackage including `jupytergis_core`, `jupytergis_lab`,
    `jupytergis_qgis`, `jupyter-collaboration`, and `jupyterlab`.
  * `jupytergis_core`: Python methods specific to JupyterLab (not JupyterLite).
    * :star: `src/jgisplugin/plugins.ts`: Where all the commands we've defined are
      registered in TypeScript land -- defines behaviors for menu items.
    * `src/jgisplugin/plugins.ts`: Where commands are linked to layer and source context
      menus.
  * `jupytergis_lab`: _TODO: Ask Martin_.
    * :star: `jupytergis_lab/notebook/gis_document.ts`: Entrypoint for Python API.
    * `src/notebookrenderer.ts`: Enables rendering JupyterGIS in a Notebook.
  * `jupytergis_lite`: A metapackage for deployment and testing of JupyterGIS in
    JupyterLite.
  * `jupytergis_qgis`: Enables importing and exporting QGIS project files.
* `packages/`: The TypeScript packages.
  * `base/`:
    * `src/index.ts`: Entrypoint for Typescript code.
    * :star: `src/constants.ts`: Defines all the JupyterGIS command names and
      corresponding icons.
    * :star: `src/commands.ts`: For each command, defines the labels, the behaviors, and
      in what contexts each command is available.
    * :star: `src/mainview/index.ts`: Entrypoint for the main map view.
    * `src/toolbar/widget.tsx`: Where commands are linked to the toolbar.
    * `src/formbuilder/`: Base React components for forms.
  * :star: `schema/`: The source of truth for data structures in JupyterGIS. Python
    classes and Typescript types are generated from this.


### Schema

The fundamental source of truth for many other components of JupyterGIS.

* Forms: Generated from e.g. `schema/src/schema/project/layers/vectorlayer.json`
* Project file / shared model: `schema/src/schema/project/jgis.json`


### Model

Structure defined in schema `packages/schema/src/schema/project/jgis.json`.


#### Shared model

All collaborators share this and listen for changes to this. It mediates changes with
Conflict-free Replicated Data Types (CRDTs), which is handled by `yjs`. It is the "magic
sauce" that enables collaboration!

:::tip
You can view the shared model in many contexts by writing
`console.log(model.sharedModel)` in a JupyterGIS TypeScript file!
:::


### Commands

Many new features are a matter of defining a new command.


### Forms

Many forms are generated from `BaseForm`, but some forms use other classes which extend
`BaseForm`. Each of these classes accepts the relevant schema a property in order to
generate the form on-the-fly. The correct form class is selected in `formselector.ts`.

_TODO: How much of this is specific to JGIS and how much is generic and could be
extracted to a third-party package?_


### Signals

Signals are a [Lumino](https://lumino.readthedocs.io/en/latest/api/index.html) framework thing.

_TODO: We need some help defining this section. Is this helping with listening to model
changes? Do they carry CRDT payloads? Or simpler payload, e.g. `onLayerChange` signal
carrying the layer ID of a changed layer?_

Read more: https://www.youtube.com/channel/UCejhDXmzOrxhsTsQBWe-pww/videos


### Map view

Uses [OpenLayers](https://openlayers.org/doc/) as a rendering engine.


`packages/base/src/mainview/index.ts`


#### Swappable rendering engine?

The Venn Diagram of the JavaScript map rendering engine ecosystem unfortunately looks
like a bunch of disparate circles with few overlaps. The burden of understanding this is
very high, and we hope to avoid shifting this burden on to our users.

For example, OpenLayers has excellent support for alternative map projections and
excellent low-level API, but lacks support for visualizing huge vector datasets with the
GPU. DeckGL can quickly render huge datasets, but lacks projection support.
