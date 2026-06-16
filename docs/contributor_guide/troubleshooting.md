# Troubleshooting

## Setup of development environment hangs indefinitely when running the `dev-install.py` step, specifically on the Yarn linking step.

This may be caused by having a `.gitignore` file in your home directory.
This is a [known issue with Nx](https://github.com/nrwl/nx/issues/27494).
The [only known workaround](https://github.com/nrwl/nx/issues/27494#issuecomment-2481207598)
is to remove the `.gitignore` file from your home directory or to work in a location
outside of the home directory tree.

## Setup of development environment fails for missing `build_log.json`

```
ERROR: Could not install packages due to an OSError: [Errno 2] No such file or directory: '/home/myuser/micromamba/envs/jupytergis/share/jupyter/labextensions/@jupytergis/jupytergis-core/build_log.json'
```

This error can occur when re-using a conda environment across different working
directories.

To resolve, remove your conda environment and
[recreate it](/contributor_guide/development_setup.md):

```bash
micromamba env remove -n jupytergis_dev
micromamba create #... see the dev setup guide
```

## Every UI test fails after 60 seconds due to timeout.

This could be caused by having a JupyterLab instance already running at port `:8888`.
Please ensure that there is nothing running at <http://localhost:8888/lab> before
running tests.

## Build fails in CI with error about `.yarn-state.yml`

```
Error: ENOENT: no such file or directory, unlink '/home/runner/work/jupytergis/jupytergis/node_modules/.yarn-state.yml'
```

Re-running the job can get you past this error.
