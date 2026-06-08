"""Workaround for micromamba mishandling ``nodefaults`` in config vs. CLI.

``jupyterlite-xeus`` creates the emscripten kernel environment with
``micromamba create`` and passes channels from ``environment.yml`` on the
command line. When ``nodefaults`` is present in micromamba configuration but
not on the CLI, ``micromamba`` 2.8.0 can fail to resolve packages from
emscripten-forge channels.

This monkey patch ensures ``nodefaults`` is always passed as a channel when
creating the xeus environment. It is applied from ``import jupytergis`` and
from the ``jupytergis-xeus-workaround`` JupyterLite addon (which runs in the
``jupyter lite build`` subprocess spawned by ``jupyterlite-sphinx``). It can be
removed once micromamba 2.8.1 is released with
https://github.com/mamba-org/mamba/pull/4308.

https://github.com/geojupyter/jupytergis/pull/1483#issuecomment-4645916705
"""

import functools


@functools.cache
def _patch_create_conda_env_from_specs_impl() -> None:
    try:
        from jupyterlite_xeus import create_conda_env
    except ImportError:
        return

    _original = create_conda_env._create_conda_env_from_specs_impl

    def _create_conda_env_from_specs_impl(
        env_name,
        root_prefix,
        specs,
        channels,
    ):
        if "nodefaults" not in channels:
            channels = [*channels, "nodefaults"]
        return _original(env_name, root_prefix, specs, channels)

    create_conda_env._create_conda_env_from_specs_impl = (
        _create_conda_env_from_specs_impl
    )
