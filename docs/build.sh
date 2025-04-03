#!/usr/bin/env bash

THIS_DIR="$( cd "$(dirname "$0")"; pwd -P )"

# Build can fail if certain artifacts exist here:
rm -rf "${THIS_DIR}/_build"

python -m sphinx \
    --nitpicky --show-traceback \
    --fail-on-warning --keep-going \
    --builder html --doctree-dir _build/doctrees --define language=en \
   . \
   ./_build/html
