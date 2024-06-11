# Copyright (c) Jupyter Development Team.
# Copyright (c) Voici Contributors

# Distributed under the terms of the Modified BSD License.import click

import argparse
import json
from packaging.version import parse as parse_version
from pathlib import Path
from subprocess import run


ENC = dict(encoding="utf-8")
HATCH_VERSION = "hatch version"
ROOT = Path(__file__).parent.parent


def get_version():
    cmd = run([HATCH_VERSION], capture_output=True, shell=True, check=True, cwd=ROOT)
    return cmd.stdout.decode("utf-8").strip().split("\n")[-1]


def next_version():
    v = parse_version(get_version())
    if v.is_prerelease:
        return f"{v.major}.{v.minor}.{v.micro}{v.pre[0]}{v.pre[1] + 1}"
    return f"{v.major}.{v.minor}.{v.micro + 1}"


def bump():
    parser = argparse.ArgumentParser()
    parser.add_argument("version")
    args = parser.parse_args()
    py_version = next_version() if args.version == "next" else args.version
    js_version = (
        py_version.replace("a", "-alpha.").replace("b", "-beta.").replace("rc", "-rc.")
    )
    package_json = ROOT.parent.parent / "package.json"
    root_json = json.loads(package_json.read_text(encoding="utf-8"))
    root_json["version"] = js_version
    package_json.write_text(json.dumps(root_json), encoding="utf-8")
    run(["yarn", "install"], check=True)
    run(
        [
            "node",
            f"{ROOT.parent.parent / 'node_modules/prettier/bin/prettier.cjs'}",
            "--write",
            package_json,
        ],
        check=True,
    )
    # bump the Python version with hatch
    run(f"{HATCH_VERSION} {py_version}", shell=True, check=True, cwd=ROOT)
    # bump the JS version with lerna
    run(f"yarn run bump:js:version {js_version}", shell=True, check=True)


if __name__ == "__main__":
    bump()
