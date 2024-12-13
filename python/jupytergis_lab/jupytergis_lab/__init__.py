try:
    from ._version import __version__
except ImportError:
    # Fallback when using the package in dev mode without installing
    # in editable mode with pip. It is highly recommended to install
    # the package from a stable release or in editable mode: https://pip.pypa.io/en/stable/topics/local-project-installs/#editable-installs
    import warnings

    __version__ = "dev"

import sys

if sys.platform == "emscripten":
    raise ImportError(
        "Cannot use the JupyterGIS Python API in a JupyterLite kernel yet"
    )

from .notebook import GISDocument  # noqa


def _jupyter_labextension_paths():
    return [{"src": "labextension", "dest": "@jupytergis/jupytergis-lab"}]
