#!/usr/bin/env bash
set -euo pipefail

THIS_DIR="$( cd "$(dirname "$0")"; pwd -P )"
rm -rf "${THIS_DIR}/_build"
