# Building JupyterGIS documentation locally

:::{important}
Navigate to the `docs/` directory before starting any of these steps!
:::

:::{tip}
You can use `conda` or `mamba` as drop-in replacements for `micromamba` in the steps
below, but they will not be as fast.
:::

## 1. Create the environment from `environment-docs.yml`

```
micromamba create -f environment-docs.yml
```

## 2. Activate the `jupytergis-docs` environment

```
micromamba activate jupytergis-docs
```

## 3. Build the documentation

:::{note}
You may experience failure at this step. Carefully read the last message. Did the build
fail due to warnings? You may need to search the full log output for "WARNING" to find
the cause.
:::

```
./build.sh
```

## 4. Open the documentation

Once the build is successful, open:

```
_build/html/index.html
```

## 5. Repeat!

Every time you make edits to documentation, repeat steps 3 and 4.
