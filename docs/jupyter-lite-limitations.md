# JupyterLite preview limitations

The **Try with JupyterLite** button launches JupyterGIS through a WASM build entirely inside your web browser, with no server running behind it. Normally JupyterGIS relies on a server (either on your own computer or in the cloud) to run Python, talk to other collaborators, and process data. JupyterLite removes that server and does everything locally in the browser tab instead. This makes it wonderfully easy to try with zero setup. The trade-off is that any feature which depends on a server will either be unavailable or behave unexpectedly.

The JupyterLite preview is intended as a demo and exploration environment, not a full replacement for a proper JupyterGIS installation. To install the full extension locally in JupyterLab, or in a JupyterHub environment, see the [install guide](user_guide/install.md).

## What won't work (or won't work as expected)

- **Real-time collaboration:** There is no server to sync changes between people, so shared sessions, live cursors, annotations, and comments are not available.
- **QGIS import & export:** Reading and writing `.qgs`/`.qgz` project files requires a server-side component and is disabled in the browser.
- **Server-side processing for raster data:** Dynamic raster tiling via Jupyter-Tiler is unavailable.
- **Saving your work:** Projects are saved to temporarily in the broswer tab rather than to disk. Files will be deleted when you close the tab. Download anything you want to keep.
- **Loading large or remote datasets:** External data sources may fail to load if the server hosting them does not allow cross-origin (CORS) requests, and very large datasets can be slow or exhaust the browser's memory.
- **The Python API:** Python runs in a limited in-browser environment (Pyodide), so many scientific packages are unavailable or must be installed differently. API methods that need a server — such as TiTiler tile serving and QGIS import/export — will not work.

For the full experience, see the [install guide](user_guide/install.md).
