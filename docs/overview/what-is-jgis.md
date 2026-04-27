# What is JupyterGIS? What is it _not_?

## What is JupyterGIS?

### A reimagination of traditional GIS paradigms

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

## What is JupyterGIS _not_?

### A reimplementation of traditional GIS paradigms

```{figure} ./jupytergis-venn-diagram.svg
:alt: A Venn diagram of our vision of JupyterGIS' relationship to Jupyter Notebooks. The overlapping section between the two reads "Data analysis" and has an orange background, to indicate that this is territory that is already served well by Jupyter Notebooks. The JupyterGIS section contains two regions -- the "Exploration/viz layer" region which contains elements "share", "search", "discover", "draw/calculate AOIs", "identify patterns", "link w/ non-geo data", "validate"; and the "Utility layer" region contains elements "programmatic viz", "assist w/ coding", "transfer AOIs", "access", and "update map when data changes". The "Utility layer" sits between the "Exploration/viz layer" region and the "Data analysis" overlap region. An orange two-sided arrow connects the "Data analysis layer" and the "Exploration/viz layer" via the "Utility layer".

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

With these lessons in mind, we feel that our primary focus on JupyterGIS should _not_ be
on reimplementing "geoprocessing" toolboxes, and that we should instead focus on utility
functionality that **supports and streamlines** analysis done in a Notebook environment.
