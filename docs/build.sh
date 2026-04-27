#!/usr/bin/env bash
set -euo pipefail

THIS_DIR="$( cd "$(dirname "$0")"; pwd -P )"

# Build can fail if certain artifacts exist here:
${THIS_DIR}/clean.sh

python -m sphinx \
    --nitpicky --show-traceback \
    --fail-on-warning --keep-going \
    --builder html --doctree-dir _build/doctrees --define language=en \
   . \
   ./_build/html
