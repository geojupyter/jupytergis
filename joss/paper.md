---
title: 'JupyterGIS: A Collaborative GIS Environment for JupyterLab'
tags:
  - Python
  - GIS
  - Jupyter
  - GeoSciences
authors:
  - name: Martin Renou
    orcid: 0009-0002-3422-9156
    affiliation: 1
  - name: Arjun Verma
    orcid: 0009-0007-3278-9607
    affiliation: 1
  - name: Matt Fisher
    orcid: 0000-0003-3260-5445
    affiliation: 2
  - name: Gregory Mooney
    affiliation: 1
  - name: Nicolas Brichet
    orcid: 0009-0009-2649-1809
    affiliation: 1
  - name: David Brochart
    orcid: 0009-0007-2318-0285
    affiliation: 1
  - name: Anne Fouilloux
    orcid: 0000-0002-1784-2920
    affiliation: 3
  - name: Sylvain Corlay
    orcid: 0009-0007-2816-4102
    corresponding: true
    affiliation: 1
  - name: Fernando Pérez
    orcid: 0000-0002-1725-9815
    affiliation: 2

affiliations:
  - name: QuantStack, France
    index: 1
  - name: Eric and Wendy Schmidt Center for Data Science & Environment at UC Berkeley, United States
    index: 2
  - name: LifeWatch ERIC, Spain
    index: 3

date: 21 December 2025
bibliography: paper.bib
---

# Summary

JupyterGIS is a JupyterLab [@JupyterNotebooks2018] extension that enables collaborative, web-based Geographic Information System (GIS) workflows. It provides a familiar GIS interface inspired by traditional desktop GIS tools, real-time collaborative editing, and a Python API for programmatic control, making it a powerful tool for geospatial data analysis, visualization, and sharing. JupyterGIS supports a wide range of geospatial data formats, including GeoTIFFs and Cloud-Optimized GeoTIFFs, Shapefile, GeoParquet, and PMTiles, and provides advanced features such as symbology editing, spatio-temporal animations, and a browser-based processing toolbox powered by WebAssembly (WASM) builds of GDAL [@GDAL2025].

The extension is designed to enhance productivity and collaboration among researchers, educators, developers, or any person working with geospatial data.

# Statement of need

Geospatial data analysis and visualization are essential in fields such as environmental science, urban planning, and disaster management. However, traditional GIS tools often lack real-time collaboration and seamless integration with computational notebooks. JupyterGIS addresses these gaps by:

- Enabling **real-time collaborative editing** (similar to Google Docs) for GIS projects.
- Providing **interactive maps and geospatial visualizations within Jupyter notebooks**.
- Supporting **programmatic control** via a Python API, allowing for automation and reproducibility.
- Offering **browser-based access to GIS workflows**, reducing the need for desktop software.

JupyterGIS is particularly valuable for teams working on shared geospatial projects, educators teaching GIS concepts, and researchers who need to integrate GIS workflows with data science tools.

# Features

| Feature                           | Description                                                                                                                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Collaborative GIS Environment** | Real-time editing and collaboration on GIS projects, including the ability for collaborators to follow the action and perspective of another user and make annotations on the map. |
| **QGIS File Support**             | Partial support for QGIS [@QGIS2025] project file formats (.qgs, .qgz), enabling users to load, visualize, and edit projects with some limitations.                                |
| **Interactive Maps**              | Render and interact with geospatial data directly in JupyterLab.                                                                                                                   |
| **Processing Toolbox**            | Browser-based geospatial processing tools (e.g., buffer, convex hull, dissolve) powered by GDAL/WASM.                                                                              |
| **Symbology Enhancements**        | Flexible styling options, including graduated, categorized, and canonical symbology.                                                                                               |
| **STAC Integration**              | Embedded STAC browser for data discovery and integration.                                                                                                                          |
| **Vector Tile Support**           | Full compatibility with vector tiles, including the PMTiles format.                                                                                                                |
| **Data Format Support**           | GeoTIFF, Shapefile, GeoParquet (through a conversion to GeoJSON), PMTiles, and more.                                                                                               |
| **Xarray integration**            | With the JupyterGIS-tiler extension, create JupyterGIS layers from xarray variables, enabling lazy evaluation and bridging geospatial and array-based workflows.                   |
| **JupyterLite Integration**       | JupyterGIS can be used in combination with JupyterLite and be deployed in a fully static fashion without requiring a server.                                                       |
| **Story Maps**                    | JupyterGIS includes a Story Map feature, an interactive combination of a JupyterGIS map, text, images, and multimedia, to include a compelling narrative in a map.                 |

# Installation

JupyterGIS can be installed from:

PyPI:

```
python -m pip install jupytergis
```

Conda-forge:

```
mamba install -c conda-forge jupytergis
```

# Architecture

JupyterGIS is built as a JupyterLab extension, leveraging modern Web technologies:

- **Frontend**: The frontend is built upon the JupyterLab application framework, and utilises React for the main control panels.
- **Collaborative editing**: Real-time synchronization utilises JupyterLab’s collaborative editing infrastructure, which is built upon the YJS ecosystem (YJS, PyCRDT) [@YJS2015].
- **Processing**: the processing toolbox is based on a WebAssembly build of GDAL.
- **Visualisation**: The map viewer of JupyterGIS is powered by OpenLayers [@OpenLayers2025]

# Community and Contributions

JupyterGIS is an open-source project under the BSD 3-Clause License. Contributions are welcome via:

- **GitHub Repository**: geojupyter/jupytergis
- **Documentation**: jupytergis.readthedocs.io
- **Community Discussions**: GeoJupyter Zulip channel

# Future Work

The JupyterGIS team plans to:

- Expand the GDAL-based processing toolbox.
- Deepen integration with QGIS and enrich the Python API.

# Acknowledgments

JupyterGIS was developed at QuantStack and at the Eric and Wendy Schmidt Center for Data Science & Environment at UC Berkeley, with financial support from the European Space Agency (ESA) and the Centre National d’Études Spatiales (CNES).

# References
