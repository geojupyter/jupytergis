# Comparison with other GIS tools

These architectural choices place JupyterGIS in a unique position in the GIS landscape — at the intersection of collaborative editing, computational notebooks, and cloud-native geospatial.
If you believe any of these comparisons is inaccurate, please [open an issue](https://github.com/geojupyter/jupytergis/issues/new) so we can correct it.

## QGIS

[QGIS](https://qgis.org) is the leading open-source desktop GIS — mature, feature-rich, and backed by a huge community.
As JupyterGIS, it is committed to open source and other open standards.
JupyterGIS can import and export QGIS project files (`.qgs`/`.qgz`), making it interoperable with QGIS.

**QGIS** is desktop-first: a powerful local IDE with efficient geoprocessing, rich cartography, print layouts, and a flexible plugin system.
It excels at workflows that require deep local processing and offline work.

**JupyterGIS** is browser-first: no installation required, embeddable, shareable via a URL, and built with modern browser UI libraries.
It can optionally decouple computation from the interface via the Jupyter protocol, making it cloud-native and ready for heavy data processing.
It is highly scriptable — via Python and natural-language prompts (Jupyter AI / JupyterLite AI) — and collaborative-first via CRDTs (Yjs/YDoc).

## ArcGIS

[ArcGIS](https://www.esri.com/en-us/arcgis/about-arcgis/overview) (Esri) is the industry-standard commercial GIS platform — powerful, feature-complete, and mature.

**ArcGIS** is proprietary and closed-source with per-seat licensing and a deep ecosystem (Living Atlas, ArcGIS Online).
It is the default choice for many organizations already invested in Esri infrastructure, but it cannot be inspected, modified, or independently audited, and it is governed by a single company.

**JupyterGIS**, in contrast, is free, open source, community-driven with multiple organizational stakeholders, and built for modification and integration.
It is also browser-first, scriptable, cloud-native, and can connect to powerful backend kernels.
Due to its open nature, JupyterGIS excels when you need tight integration with other systems, browser-first access, customization and sovereign infrastructure that you control.

## Google Earth Engine

[Google Earth Engine](https://earthengine.google.com/) (GEE) is a cloud platform for planetary-scale geospatial analysis, backed by Google's data catalog and compute infrastructure.

**GEE** is proprietary, closed-source, and tightly coupled to Google's infrastructure. It offers an unmatched data catalog but cannot be inspected or modified, is difficult to integrate with external systems, and cannot be self-hosted. It is governed by a single company.

**JupyterGIS** integrates with open-source tools for compute-heavy workloads: Jupyter kernels for arbitrary server-side processing, [OpenEO](https://openeo.org/) for cloud processing, and [TiTiler](https://developmentseed.org/titiler/) for dynamic raster tile serving backed by the Pangeo stack.
JupyterGIS is open source, self-hostable, and built for integration — offering cloud-native processing via open standards rather than a single vendor's infrastructure.

## Felt

[Felt](https://felt.com) is a modern, collaborative web-based mapping tool focused on ease of use for non-technical users.

**Felt** is a proprietary SaaS with a polished, Miro-like experience for visual collaboration.
It offers enterprise VPC deployment for regulated industries, but the source code is closed — it cannot be inspected, modified, or independently audited, and it is governed by a single company.
Felt does not support scripting or integration with computational workflows.

**JupyterGIS** shares the browser-first collaborative approach but is fully open source, community-driven with multiple organizational stakeholders, self-hostable on any infrastructure, and scriptable.
It adds integration with Jupyter kernels for server-side processing and deep ties to the scientific Python ecosystem.

## Rendering libraries (MapLibre, OpenLayers, Leaflet, ...)

[MapLibre](https://maplibre.org/), [OpenLayers](https://openlayers.org/), [Leaflet](https://leafletjs.com/), and similar projects are map rendering libraries — they draw maps, not build GIS environments.

JupyterGIS is a different layer of the stack. It currently uses OpenLayers for rendering and is built _on top of_ these libraries, not in competition with them. The rendering engine is decoupled from the schema and interface, so alternative renderers could be integrated in the future.
