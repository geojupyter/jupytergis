# Layer gallery configuration

This script is run at build-time to generate a JSON file which JupyterGIS uses to
display the layer gallery and add layers to the map.
That JSON file is _not_ committed to this repository.

All commands below should be run from this directory.

## Editing

Edit `config.py`.

## Local usage

The main reason to run this outside of the build context is to generate thumbnails:

```bash
uv run python generate.py --thumbnails
```

It will report on missing thumbnails you may need to generate manually, as well as
orphaned thumbnails that aren't represented in the config.

This will also generate the layer gallery JSON so you can take a look if you like.

## Testing

```bash
uv run pytest
```

This will also run in CI.

## Typechecking

```bash
uv run mypy
```

This will also run in CI.
