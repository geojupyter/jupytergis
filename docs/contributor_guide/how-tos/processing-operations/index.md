# Add a processing operation

:::{admonition} Objectives
:class: seealso

By the end of this tutorial, you will be able to add or modify data processing commands
for JupyterGIS.
:::

:::{admonition} Prerequisites
:class: warning

- Knowledge of geospatial processing operations, for example using
  [GDAL/OGR](https://gdal.org/en/stable/).
- Ability to edit JSON and [JSONSchema](https://json-schema.org/).
:::

## Overview

* `packages/schema/src/schema/processing/`: In this directory, we need to create a
  file which defines the **UI form structure for each processing operation**.
* `packages/schema/src/processing/config/`: In this directory, we need to create a
  file which defines the **processing behavior for each processing operation**.

## Creating a schema

What information is required to execute the processing step?

Most processing operations need an input layer and some other parameters. Here, under
the `properties` key, we define a schema which requires an input layer and a buffer
distance. The required parameters are listed under the `required` key.

There's also an optional parameter to determine whether the output layer should be
embedded in the project file.

:::{admonition} Prerequisites
:class: important

Always include a description for each property!
:::


```json
{
  "type": "object",
  "description": "Buffer",
  "title": "IBuffer",
  "required": ["inputLayer", "bufferDistance"],
  "additionalProperties": false,
  "properties": {
    "inputLayer": {
      "type": "string",
      "description": "The input layer for buffering."
    },
    "bufferDistance": {
      "type": "number",
      "default": 10,
      "description": "The distance used for buffering the geometry (in projection units)."
    },
    "embedOutputLayer": {
      "type": "boolean",
      "title": "Embed output buffered layer in file",
      "default": true
    }
  }
}
```

## Configuring processing behavior

This information is used to generate the code, including a
[JupyterLab command](https://jupyterlab.readthedocs.io/en/stable/user/commands.html),
which will do the command and enable display in the UI.

**No need to edit the UI code!**

The `operation` key contains templates for generating the underlying
processing operation (often using [GDAL/OGR](https://gdal.org/en/stable/)).
Template parameters are set off with braces `{}`.

The `operationParams` key contains the attributes (from the schema defined above) that
will be injected into the processing operation templates.

`type` is a special string that determines how the processing operation is
constructed.
See the next section for more details!

```json
{
  "name": "buffer",
  "label": "Buffer",
  "operationParams": ["bufferDistance"],
  "operation": {
    "gdalFunction": "ogr2ogr",
    "sql": "SELECT ST_Union(ST_Buffer(geometry, {bufferDistance})) AS geometry, * FROM \"{layerName}\""
  },
  "type": "vector"
}
```

## Processing type

The processing `type` attribute from the config shown above determines which logic will
be used to generate commands.

:::{admonition} Prerequisites
:class: important

The processing type you use **must** be defined in
`packages/base/src/processing/processingCommands.ts`.

If no existing types satisfy your needs, then you'll need to add a new case.
:::
