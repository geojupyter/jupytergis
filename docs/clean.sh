#!/usr/bin/env bash
set -euo pipefail

THIS_DIR="$( cd "$(dirname "$0")"; pwd -P )"
# Only wipe the jupyterlite output — this avoids the "conflicting notebook
# basename" error in jupyterlite_sphinx on incremental builds while keeping
# the Sphinx doctree cache intact. On CI (ReadTheDocs) _build never exists
# beforehand so this makes no difference there.
rm -rf "${THIS_DIR}/_build/html/lite"
