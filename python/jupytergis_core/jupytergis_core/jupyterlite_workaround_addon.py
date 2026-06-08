"""JupyterLite addon that applies the xeus micromamba workaround before build."""

from jupyterlite_core.addons.base import BaseAddon

from .jupyterlite_xeus_workaround import _patch_create_conda_env_from_specs_impl


class JupyterGISXeusWorkaroundAddon(BaseAddon):
    """Apply the ``nodefaults`` channel workaround before xeus creates its env."""

    __all__ = ["pre_build"]

    def pre_build(self, manager):
        _patch_create_conda_env_from_specs_impl()
        yield from ()
