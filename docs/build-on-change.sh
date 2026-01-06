#!/usr/bin/env bash
# NOTE: Requires `inotify-tools`. e.g. `apt install inotify-tools`.
# TODO: MacOS support?
set -euo pipefail

THIS_DIR="$( cd "$(dirname "$0")"; pwd -P )"
cd "${THIS_DIR}"
HTML_PATH="./_build/html/index.html"

${THIS_DIR}/clean.sh

set +e
${THIS_DIR}/build.sh
xdg-open "${HTML_PATH}"
set -e

while inotifywait -e delete -e create -e close_write -r ${THIS_DIR}; do
    ${THIS_DIR}/clean.sh

    set +e
    ${THIS_DIR}/build.sh
    set -e
done
