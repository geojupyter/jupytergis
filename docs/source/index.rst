==========
JupyterGIS
==========

JupyterGIS is a JupyterLab extension for collaborative GIS (Geographical Information System). It is designed to 
allow multiple people to work on the same geospatial project simultaneously, facilitating discussion and collaboration 
around map layers, spatial analyses, and other GIS data being developed.

JupyterGIS provides basic support for `QGIS <https://www.qgis.org>`_ project files, allowing users to import and export
projects seamlessly between QGIS and JupyterLab.
This compatibility preserves layer styles, data sources, and project settings, enabling smooth transitions between GIS work
in QGIS and collaborative, cloud-based work in JupyterLab.

Beyond QGIS project support, JupyterGIS offers a range of features tailored specifically for collaborative geospatial analysis. 
Users can edit, visualize, and analyze spatial data together in real-time, share map layers, and annotate directly within the 
JupyterLab environment, fostering efficient teamwork on GIS projects. 

Python users can further extend JupyterGIS workflows by integrating with Python geospatial libraries, such as GeoPandas, Xarray 
and Rasterio, to perform custom analyses and automate processes. Together, these features make JupyterGIS a powerful tool for 
both collaborative mapping and in-depth geospatial analysis.

.. image:: ../../jupytergis.png
  :alt: JupyterGIS application

Table of contents
=================

.. toctree::
   :maxdepth: 2

   install
   extension
   python_api
   collab.rst
   contributing.rst
