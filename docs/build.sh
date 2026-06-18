#!/usr/bin/env bash
set -euo pipefail

THIS_DIR="$( cd "$(dirname "$0")"; pwd -P )"
cd "${THIS_DIR}"

# Build can fail if certain artifacts exist here:
${THIS_DIR}/clean.sh

# .ipynb_checkpoints in examples/ causes jupyterlite to fail with exit code 1
if [ -d "${THIS_DIR}/../examples/.ipynb_checkpoints" ]; then
    echo "ERROR: examples/.ipynb_checkpoints exists and will break the jupyterlite build."
    echo "       Remove it with: rm -rf examples/.ipynb_checkpoints"
    exit 1
fi

python -m sphinx \
    --nitpicky --show-traceback \
    --fail-on-warning --keep-going \
    --builder html --doctree-dir _build/doctrees --define language=en \
   . \
   ./_build/html
