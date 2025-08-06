# Release JupyterGIS packages

## Automated Releases with `jupyter_releaser`

We use [`jupyter_releaser`](https://jupyter-releaser.readthedocs.io/en/latest/) to
create our releases in GitHub Actions.
This document is a quick reference that will work for most releases.
For full detailed instructions, see the
[`jupyter_releaser` "Making your first release" document](https://jupyter-releaser.readthedocs.io/en/latest/get_started/making_release_from_repo.html).

:::{important}
**This project uses [Semantic Versioning](https://semver.org)**.
:::

## Step 1a: Prep release

**This step will bump versions, update the changelog, and create a "draft" release in
GitHub.**

- From the [JupyterGIS actions menu](https://github.com/geojupyter/jupytergis/actions),
  select "Step 1: Prep Release" action from the left pane.
- On the right, click "Run workflow". This will present a menu you need to fill out.
- The only thing you normally need to input here is the "new version specifier".
  **The default value is `next`, but we recommend always specifying a numeric specifier, e.g. `0.3.0`**.

  :::{danger}
  **Specifying a version part (e.g. `minor` or `patch`) for "New Version Specifier" will
  cause Step 2 to fail.**

  Read below for more important information about the version specifier.
  :::

### Version specifier

Ensure you understand the [Semantic Versioning](https://semver.org) version part
definitions ("major", "minor", "patch") before selecting a version.

:::{important}
Because this project is currently in early development (pre-1.0), we **do not bump the
major version number**.

This means that **even breaking changes are minor version bumps**.

See [the SemVer FAQ](https://semver.org/#how-should-i-deal-with-revisions-in-the-0yz-initial-development-phase) for more details.
:::

## Step 1b: Review changelog

**This step will make the release notes more readable for end-users.**

- Visit the new [GitHub "draft" release](https://github.com/geojupyter/jupytergis/releases) created in Step 1a.
- Edit the release text to fix any typos and make other edits for end-user
  accessibility.
  - Remove any bot-created PRs, for example pre-commit hook updates or dependabot PRs.
  - Remove any bots from the contributor list.
  - Edit text for readability by end-users where appropriate.
  - **Click "Save draft" to save your changes**.

    :::{danger}
    **Do not click "Publish a release" in the GitHub UI**.
    That will be done automatically in Step 2.
    :::

## Step 2: Publish a release

- From the [JupyterGIS actions menu](https://github.com/geojupyter/jupytergis/actions),
  select "Step 2: Publish Release" action from the left pane.
- On the right, click "Run workflow". This will present a menu, but you can leave it
  blank.

## Step 3: Conda Forge release

:::{important}
Before moving on to the Conda Forge release, ensure that JupyterGIS has released on PyPI.
Check [the PyPI JupyterGIS page](https://pypi.org/project/jupytergis/) to see if the new
release is present.
:::

After the PyPI release, a Conda Forge bot will automatically open a PR on
[our feedstock repo](https://github.com/conda-forge/jupytergis-packages-feedstock).

If this is taking too long, you may trigger it manually by opening an issue with the
title `@conda-forge-admin, please update version`.

If you need maintainer access to handle releases, you may request access by opening an
issue with the title `@conda-forge-admin, please add user @my-username`.

:::{caution}
If the dependencies of JupyterGIS have changed, the Conda Forge recipe must also be
manually updated -- the bot will not do this for you, but it will likely warn you in a
comment that it must be done.

Please update `recipe/meta.yaml` to reflect those changes.
:::

Once the Conda Forge PR is merged, it may take up to an hour for it to be installable.
Even after the new release is visible on
[the Anaconda.org JupyterGIS page](https://anaconda.org/conda-forge/jupytergis/files),
it may still take up to another hour until it's actually installable with `micromamba`
or similar tools.

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

## Troubleshooting

### "Step 2: Publish release" fails to build a package with a version like `minor`

In Step 1, if you provide a version specifier like `next`, `patch`, or `minor`, Step 2
will fail.
Please specify a numeric version specifier like `0.3.0`.

**If you need to re-run Step 1, delete the draft release it created first**, then start
over.
