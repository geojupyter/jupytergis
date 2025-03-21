(python-api)=

# Python API

## Basic Usage

JupyterGIS provides a Python API that can be used for opening QGIS projects,
add raster or vector layers and apply filtering.

You can open an existing QGIS project and **display it in your Jupyter Notebook**:

```Python
from jupytergis import GISDocument

doc = GISDocument('file.qgz')

doc
```

**Opening an existing file connects you to the file’s collaborative session**,
meaning that anyone working on the same QGIS project file, whether through the
JupyterLab extension or the Python API, will see the edits you make.

Creating a `GISDocument` object without providing a path to an existing file would create a
new empty document:

```Python
from jupytergis import GISDocument

doc = GISDocument()

doc
```

Once the document is opened/created, you can start creating GIS layers.

## `GISDocument` API Reference

```{eval-rst}
.. autoclass:: jupytergis_lab.GISDocument
    :members:
```
