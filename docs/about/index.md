# About

```{toctree}
:maxdepth: 2
:caption: About
:hidden:

comparison
```

## A reimagination of traditional GIS paradigms

JupyterGIS is exploring new territory at the intersection of desktop GIS and
cloud-native geospatial.
Our goal is to bring modern, desktop-like GIS workflows to the cloud, meeting
researchers where they already work: JupyterLab.

Pre-existing desktop GIS tools like the legendary [QGIS](https://qgis.org) were
conceived in a different era.
Geospatial is a fast-moving domain and today, new opportunities exist to make GIS
workflows less stressful and more joyful, and it's our goal to take advantage of those
opportunities by rethinking what GIS can be.
For example, JupyterGIS is designed from the ground up with real-time collaboration and
integration with Jupyter Notebooks in mind.

## What JupyterGIS is _not_

```{figure} ./jupytergis-venn-diagram.svg
:alt: A Venn diagram of our vision of JupyterGIS' relationship to Jupyter Notebooks.

A Venn diagram of our vision of JupyterGIS' relationship to Jupyter Notebooks.
```

As JupyterGIS is built for integration with Jupyter Notebooks, it's important to
consider how the traditional desktop GIS paradigm might conflict with that integration.

For example, traditional desktop GIS tools offer "processing" or "geoprocessing" tools
which can be pipelined to produce unique analyses.
For many practitioners that we've interviewed, the Jupyter Notebook ecosystem and the
Scientific Python ecosystem serve that data analysis need very well.
As the _data analysis_ part of their workflow is where their expertise lies, these
geospatial researchers find integration of visualization into their workflow to be a
much larger challenge, and this is often a reason for them to leave their Notebook
environment and open up QGIS.
While QGIS serves this need very well, the friction and mental context switching
introduced by working in two disjoint applications presents a definite challenge.

With these lessons in mind, the primary focus of JupyterGIS is _not_ on reimplementing
"geoprocessing" toolboxes, but on utility functionality that **supports and streamlines**
analysis done in a Notebook environment. Where processing is needed, JupyterGIS
delegates to established tools — GDAL for local operations, and cloud-native services
like [OpenEO](https://openeo.org/) and [TiTiler](https://developmentseed.org/titiler/)
for server-side raster processing at scale.

## Architecture

JupyterGIS is built on top of the [Jupyter](https://jupyter.org/) ecosystem.
This gives it browser-based UI, kernel integration for server-side computation, real-time collaboration infrastructure, AI integration (via [Jupyter AI](https://github.com/jupyterlab/jupyter-ai) / [JupyterLite AI](https://github.com/jupyterlite/ai)), and deployment options ranging from zero-install browser links ([JupyterLite](https://jupyterlite.readthedocs.io/)) to multi-user servers ([JupyterHub](https://jupyterhub.readthedocs.io/)).
However, JupyterGIS can also be used independently — as a standalone web application or an embeddable map widget — without requiring a full Jupyter environment.
The following sections illustrate the key architectural choices that follow from this foundation.

### Browser-first

JupyterGIS is browser-native by default, using WebAssembly to run tools like [GDAL](https://gdal.org) client-side, and it can be deployed as a zero-server JupyterLite site with full Python capabilities.
This means anyone can open a map and start exploring without installing software or provisioning a server.
Removing the server requirement drastically lowers the barrier to entry — a shared URL is all it takes to put a project in front of a collaborator, a student, or a reviewer.

### Compute kernels: browser or backend

While the UI is browser-first, JupyterGIS integrates with compute kernels that can run either in the browser (via [Xeus](https://github.com/jupyter-xeus/xeus)/WebAssembly) or on a traditional Jupyter server backend.
This lets users start lightweight and scale up: quick exploration happens client-side, while heavy processing can be offloaded via a server kernel with access to powerful hardware.
The same Python API and notebooks work in both modes, so workflows are portable between a local laptop, a JupyterHub deployment, and a zero-install JupyterLite link.

### Serializable document as source of truth

Every JupyterGIS project is a single `.jGIS` JSON document that serves as the canonical source of truth.
This document is managed as a [Yjs](https://yjs.dev/) shared type (YDoc), which enables real-time collaborative editing with conflict-free resolution — multiple users can modify layers, styles, and annotations simultaneously without coordination.
Because the document is a plain JSON file, it is easy to version-control, diff, and programmatically generate or transform, making GIS projects first-class citizens in reproducible research workflows.

### Decoupled renderer

The map renderer is separated from the document schema and the user interface.
Currently JupyterGIS delegates rendering to [OpenLayers](https://openlayers.org/), but the architecture is designed to be independent of this choice — other renderers (e.g. MapLibre, Cesium) are imaginable in the future.

### Flexible use within other UIs

JupyterGIS can be embedded in different contexts: as a standalone map viewer, as in-browser GIS integrated in JupyterLab, or as an interactive widget inside a Jupyter notebook.
The same project can be presented as a polished read-only map for stakeholders, an interactive workspace for analysts, or an inline visualization in a computational narrative.

### Open source and modular

JupyterGIS is open source (BSD-3) and built with a modular architecture.
This design allows modification, adaptation, and integration into other systems — for example embedding a JupyterGIS map in a web application or driving it programmatically from a custom workflow.
