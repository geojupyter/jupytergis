try:
    from ._version import __version__
except ImportError:
    # Fallback when using the package in dev mode without installing
    # in editable mode with pip:
    # https://pip.pypa.io/en/stable/topics/local-project-installs/#editable-installs
    import warnings

    warnings.warn(
        "Importing 'jupytergis_lab' outside a proper installation."
        " It's highly recommended to install the package from a stable release or"
        " in editable mode.",
        stacklevel=2,
    )
    __version__ = "dev"

from .notebook import GISDocument
from .notebook.explore import explore


def _jupyter_labextension_paths():
    return [{"src": "labextension", "dest": "@jupytergis/jupytergis-lab"}]


__all__ = [
    "GISDocument",
    "explore",
]
