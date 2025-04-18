try:
    from ._version import __version__
except ImportError:
    # Fallback when using the package in dev mode without installing
    # in editable mode with pip. It is highly recommended to install
    # the package from a stable release or in editable mode: https://pip.pypa.io/en/stable/topics/local-project-installs/#editable-installs
    import warnings

    warnings.warn(
        "Importing 'jupytergis_core' outside a proper installation.",
        stacklevel=2,
    )
    __version__ = "dev"


def _jupyter_labextension_paths():
    return [{"src": "labextension", "dest": "@jupytergis/jupytergis-core"}]


def _jupyter_server_extension_points():
    return [{"module": "jupytergis_core"}]


def _load_jupyter_server_extension(server_app):
    """Registers the API handler to receive HTTP requests from the frontend extension.

    Parameters
    ----------
    server_app: jupyterlab.labapp.LabApp
        JupyterLab application instance
    """
    from .handler import setup_handlers

    setup_handlers(server_app.web_app)
    name = "jupytergis_core"
    print(f"Registered {name} server extension")
