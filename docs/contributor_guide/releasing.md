# Releasing

## Automated Releases with `jupyter_releaser`

The recommended way to make a release is to use
[`jupyter_releaser`](https://jupyter-releaser.readthedocs.io/en/latest/get_started/making_release_from_repo.html)
in GitHub Actions.
Follow the linked instructions.

**This project uses [Semantic Versioning](https://semver.org)**.

:::{important}
Because this project is in early development, we **do not bump the major version number**.
Most changes are minor version bumps, even breaking changes.
See [the SemVer FAQ](https://semver.org/#how-should-i-deal-with-revisions-in-the-0yz-initial-development-phase) for more.
:::

### Specifying a version spec

When prompted for a "New Version Specifier", the default value is `next`.
This will bump the packages as follows:

- `0.1.0a0` -> `0.1.0a1`
- `0.1.0b7` -> `0.1.0b8`
- `0.1.0` -> `0.1.1`

This is often **not** what we want.
To bump to another version, you can specify the Python version directly.
For example:

- `0.1.0b8`
- `0.4.0`
- `1.0.0`
- `1.2.0rc0`

You can also specify a version part, e.g.:

- `patch`
  - Would bump `0.3.0` -> `0.3.1`
- `minor`
  - Would bump `0.3.0` -> `0.4.0`
- `major`
  - Would bump `0.3.0` -> `1.0.0`

## Conda Forge release

After the PyPI release, a Conda Forge bot will automatically open a PR on
[our feedstock repo](https://github.com/conda-forge/jupytergis-packages-feedstock).

If this is taking too long, you may trigger it manually by opening an issue with the
title `@conda-forge-admin, please update version`.

If you need maintainer access to handle releases, you may request access by opening an
issue with the title `@conda-forge-admin, please add user @my-username`.

If the dependencies of JupyterGIS have changed, the Conda Forge recipe must also be
manually updated -- the bot will not do this for you, but it will likely warn you in a
comment that it must be done.
Please update `recipe/meta.yaml` to reflect those changes.

## Release assets

JupyterGIS is published to:

- PyPI:
  - <https://pypi.org/project/jupytergis/>: A metapackage.
- Conda Forge
  - <https://github.com/conda-forge/jupytergis-packages-feedstock>
- npm:
  - <https://www.npmjs.com/package/@jupytergis/base>
  - <https://www.npmjs.com/package/@jupytergis/schema>
  - <https://www.npmjs.com/package/@jupytergis/jupytergis-core>
  - <https://www.npmjs.com/package/@jupytergis/jupytergis-lab>
  - <https://www.npmjs.com/package/@jupytergis/jupytergis-qgis>

Release assets are also available on GitHub. For example for
[`0.3.0`](https://github.com/geojupyter/jupytergis/releases/tag/v0.3.0):
