__version__ = "0.16.0a0"

from jupytergis_core.jupyterlite_xeus_workaround import (
    _patch_create_conda_env_from_specs_impl,
)

_patch_create_conda_env_from_specs_impl()

from jupytergis_lab import GISDocument, explore  # noqa
