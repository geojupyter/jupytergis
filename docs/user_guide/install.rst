.. _install:

=====================
Installing JupyterGIS
=====================

It is best to install JupyterGIS using ``mamba`` or ``conda``, since you'll be able to install ``qgis`` as well, allowing you to open ``.qgz`` files.

.. code-block:: bash

   mamba install -c conda-forge jupytergis qgis


Alternatively, you can install JupyterGIS with ``pip``

.. code-block:: bash

   pip install jupytergis

Or you can run JupyterGIS from a Docker image:

.. code-block:: bash

   docker run -p 8888:8888 ghcr.io/geojupyter/jupytergis:latest
