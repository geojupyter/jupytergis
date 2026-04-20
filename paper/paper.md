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
    orcid: 0009-0007-5501-6471
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
  - name: Eric and Wendy Schmidt Center for Data Science & Environment, United States
    index: 2
  - name: LifeWatch ERIC, Spain
    index: 3

date: 21 December 2025
bibliography: paper.bib
---

# Summary

JupyterGIS is a JupyterLab [@JUPY2018] extension that enables web-based Geographic Information System (GIS) workflows. It provides a familiar GIS interface inspired by traditional desktop GIS tools, real-time collaborative editing, and a Python API for programmatic control, making it a powerful tool for geospatial data analysis and visualization. JupyterGIS supports a wide range of geospatial data formats, including GeoTIFFs and Cloud-Optimized GeoTIFFs, Shapefile, GeoParquet, and PMTiles, and provides advanced features such as symbology editing, spatio-temporal animations, and a browser-based processing toolbox powered by WebAssembly (WASM) builds of GDAL [@GDAL2025].

![Screenshot of JupyterGIS in action](JupyterGIS-screenshot.png)

# Statement of Need

Geospatial data analysis and visualization are essential in fields such as environmental science, urban planning, and disaster management. However, traditional GIS tools often lack **real-time collaboration** and integration with computational **notebooks**. JupyterGIS addresses these gaps by:

- Enabling **real-time collaborative editing** for GIS projects.
- Providing **interactive maps and geospatial visualizations within Jupyter notebooks**.
- Supporting **programmatic control** via a Python API, allowing for automation and reproducibility.
- Offering **browser-based access to GIS workflows**, reducing the need for desktop software.

# State of the Field

The geospatial software ecosystem comprises a broad diversity of tools addressing specific needs, including proprietary solutions and open-source alternatives, cloud-based platforms, and notebook-integrated workflows.

However, none of the existing open-source offerings address the growing demand for real-time collaboration.

## Closed-Source Desktop Solutions

**ESRI's ArcGIS** remains the dominant proprietary GIS platform, offering comprehensive tools for data management, analysis, and visualization. While ArcGIS Online provides cloud-based collaboration features, it is not as instantaneous. Edits are synchronized at scheduled intervals or manually, not in real time.

## Open-Source Desktop Solutions

**QGIS** is the leading open-source desktop GIS, renowned for its extensibility, support for diverse data formats, and vibrant community.

It provides a powerful alternative to proprietary software but does not allow real-time collaborative editing of GIS documents. As a desktop application, it must be installed on the user’s device.

## Proprietary Cloud-Based Platforms

**Google Earth Engine** enables large-scale geospatial analysis in the cloud. However, its focus on script-based workflows and lack of interactive, collaborative editing make it less suitable for teams needing real-time collaboration.

## In-Notebook Tools

Libraries like [ipyleaflet](https://github.com/jupyter-widgets/ipyleaflet) and [folium](https://github.com/python-visualization/folium) bring interactive mapping to Jupyter notebooks. While useful for exploratory analysis, these tools lack a graphical user interface for non-developers willing to create GIS documents with advanced layer styling.

# JupyterGIS

JupyterGIS brings a collaborative, desktop-style GIS experience to the web, enabling real-time coediting of GIS documents directly in JupyterLab.

## Supported Layer Types

JupyterGIS supports a broad range of **geospatial data formats** including vector formats (**GeoJSON**, **Shapefile**, **GeoParquet**), raster formats (Cloud-Optimized GeoTIFFs), as well as **raster and vector tile layers**.

## Real-time Collaboration and Annotation

JupyterGIS enables live multi-user collaboration: track cursors, follow others’ views and annotate maps in real time.

![Screenshot of the follow mode, tracking a user cursor and viewport](JupyterGIS-folow-mode.png)

## Python API

JupyterGIS provides a **Python API** for editing GIS documents from Jupyter notebooks and consoles, integrated into Jupyter’s display system. The Python API operates on the shared document like a collaborator.

![Screenshot of the Python API](JupyterGIS-python.png)

## Deployment Options

JupyterGIS can be deployed with any Jupyter-based environment, from **JupyterHub** to **JupyterLite**.

## Extensibility

JupyterGIS supports extensions, including the [**JupyterGIS-tiler**](https://github.com/geojupyter/jupytergis-tiler) plugin, which enables Xarray variables to be displayed as map layers—bridging JupyterGIS with the Pangeo ecosystem.

## The Processing Toolbox

JupyterGIS includes a set of commonly used processing operations such as buffering, dissolving, centroid computation, and convex hulls.

![Screenshot showcasing the processing toolbox](JupyterGIS-processing.png)

## Support for QGIS Project Files

JupyterGIS allows editing QGIS project files (`.qgz` and `.qgs`) directly, with a partial support of the QGIS features.

![Screenshot of JupyterGIS operating on a QGIS file](JupyterGIS-QGIS-support.png)

## Advanced Symbology

The symbology panel enables users to style vector layers with graduated, categorized, canonical, and heatmap renderers, while raster layers support single-band and multi-band visualization.

![Screenshot of JupyterGIS' advanced symbology: a graduated colormap of earthquake magnitudes](JupyterGIS-symbology-colormap.png)

## Interactive Tools and Dynamic Visualizations

- The “identify” tool allows clicking on features to view their attributes.
- Time-dependent datasets can be animated, supporting visualization of changes across time.

## Story Maps

JupyterGIS’s Story Map feature lets users combine interactive maps with text, images, and multimedia to create engaging, narrative-driven visualizations.

# Software Design

## Collaborative Editing as a First-Class Requirement: Shaping the JupyterGIS Document Model

Collaborative editing has transformed how teams work, replacing slow email exchanges with real-time collaboration. Looking ahead, the potential of co-editing extends beyond text documents, especially in designing complex systems that require diverse expertise, such as climate modeling, agriculture, and urban planning.

Users will soon expect co-editing as the norm:

- Self-collaboration: Effortless editing across devices and windows, without conflicts.
- Real-time sharing: collaboration via a link, with zero risk of data corruption.

These capabilities should be core to any application, not bolted on later.

## Building upon the JupyterLab Application Framework

Professionals depend on advanced authoring tools - IDEs, CAD modelers, and GIS applications — for daily productivity. They have high expectations for tools that they use for extended periods of time: extensibility, customization, theming, internationalization, and scriptability are strong requirements.

JupyterLab delivers these features as a robust framework, backed by a large user base and extension ecosystem. It supports collaborative editing via CRDTs (Conflict-free Replicated Data Types) [@CRDT2011] through the YJS framework [@YJS2015]. JupyterGIS builds on this foundation, integrating seamlessly with the Jupyter ecosystem and enabling serverless deployments via JupyterLite.

## The JupyterGIS Stack

JupyterGIS leverages the following technologies:

| Frontend | JupyterLab application framework |
| Collaboration | Collaborative editing with YJS and PyCRDT [@YJS2015] |
| Processing | GDAL-based [@GDAL2025] toolbox |
| Visualization | OpenLayers [@OpenLayers2025] for map rendering |

# Research Impact

## Deployments on Research Infrastructure

JupyterGIS has been deployed across several major **research infrastructures**:

- It is available on the [Copernicus Data Space Ecosystem (CDSE)](https://jupyterhub.dataspace.copernicus.eu).
- It has been integrated with the Open OnDemand portal [@OpenOnDemand2018], and deployed at the University of Oslo.
- JupyterGIS is integrated in the Galaxy Toolbox [@Galaxy2024] and deployed on the [Galaxy Europe deployment](https://usegalaxy.eu) of EOSC at usegalaxy.eu. It will soon be installed on the Earth Science thematic node of EOSC. More details on the Galaxy integration are available in an [article](https://galaxyproject.org/news/2025-05-20-jupytergis/) published on the Galaxy project's blog.

## Public Deployments

JupyterGIS is accessible through multiple public deployments:

- Ready-to-use JupyterGIS environments are available via Binder [@BINDER2018], with direct access provided in the JupyterGIS GitHub repository.
- The repository also features a **JupyterLite-based deployment**, a fully static solution that runs in the browser using **WebAssembly** for Python execution. This approach eliminates the need for cloud infrastructure, enabling **scalable and lightweight deployments**.

## Supporting Scientific Publications

JupyterGIS powers an [interactive map](https://cdr.apps.ece.iiasa.ac.at/sedimentary-basin-level-maps) of global CO₂ storage potential in sedimentary basins, hosted by IIASA and deployed via JupyterLite as supplementary material for a Nature article [@NATURE2025].

# Community and Contributions

## Contributing to JupyterGIS

JupyterGIS is available under the BSD 3-Clause License. Contributions are welcome on the [GitHub repository](https://github.com/geojupyter/jupytergis). The [documentation](https://jupytergis.readthedocs.io) is available online on ReadTheDocs. We host community discussions on a [public channel](https://jupyter.zulipchat.com/#narrow/channel/471314-geojupyter).

## The GeoJupyter Initiative

JupyterGIS has been incorporated as the first and central component of a broader initiative: [GeoJupyter](https://geojupyter.org/), a community-driven effort to reimagine geospatial computing for education, research, and industry.

# Future Work

Our roadmap includes the following future developments:

## Integration with openEO

JupyterGIS will soon support openEO [@OPENEO2021] [process graphs](https://api.openeo.org/v/0.3.0/processgraphs/) as a supported layer type, dynamically rendered as XYZ tiles in JupyterGIS. This requires extending both the document model and the Python API to embed openEO process graphs directly within JupyterGIS documents.

This integration seamlessly connects cloud-based geospatial processing with collaborative document editing.

## An R API

To extend JupyterGIS to the R ecosystem, we will develop an R API mirroring the functionality of the Python API.

This API will interact with the collaborative editing framework and the underlying data model, just as the Python API does. The primary requirement is to create R bindings for the [y-crdt](https://github.com/y-crdt/y-crdt) Rust library, which underlies the collaborative data model in the backend and the Python bindings.

## JupyterLite-AI

We will integrate JupyterGIS with JupyterLite-AI by exposing JupyterGIS features as tools to Large Lanaguage Models (LLMs). By leveraging the JupyterLab application framework, we ensured that all user actions are backed by JupyterLab commands, which are exposed to JupyterLite-AI's tool calling system.

In the screenshot below, we showcase an early example of such an integration.

# Acknowledgments

JupyterGIS was initially developed through a collaboration between **QuantStack**, the **Simula Research Laboratory**, and the **Eric and Wendy Schmidt Center for Data Science & Environment at UC Berkeley** (DSE), with additional contributions from community members.

- **QuantStack** and **Simula Research Laboratory** received funding from the European Space Agency (**ESA)** through the Open Call for EO Innovation.
- QuantStack secured additional funding from the Centre National d’Études Spatiales (**CNES**) to develop the STAC browser and story maps feature.
- QuantStack contributed further to the project through unfunded efforts.
- The **DSE** funded the contributions of its researchers to the project.

# AI Usage Disclosure

The development of JupyterGIS relied entirely on **human expertise** and traditional software engineering practices. While we leveraged developer productivity tools, such as IDE features for code auto-completion and suggestions, every contribution, including code, documentation, and design, underwent review by the core team.

This article was written entirely by humans, though we used productivity tools for grammatical corrections and proofreading.

# References
