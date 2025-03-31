#!/usr/bin/env bash

THIS_DIR="$( cd "$(dirname "$0")"; pwd -P )"

# Build can fail if certain artifacts exist here:
rm -rf "${THIS_DIR}/_build"

python -m sphinx --fail-on-warning --keep-going  --nitpicky --show-traceback \
    --builder html --doctree-dir _build/doctrees --define language=en \
   . \
   ./_build/html
