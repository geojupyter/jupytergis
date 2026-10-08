# Design principles

## JupyterGIS is Jupyter-native

Seems obvious, right?
Some design subtleties require us to keep this in mind.

E.g.: Do we allow the user to "download" a file with their browser directly in
JupyterGIS?
No, JupyterGIS is Jupyter-native so we should save the file to the filesystem and let
the user use the Jupyter file browser to download the file.
This may require more clicks to download the file, but they are familiar clicks.
This also allows the user to stay in the Jupyter ecosystem by default, and open the file
in a Notebook.
