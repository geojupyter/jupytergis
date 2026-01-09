# Copyright (c) Jupyter Development Team.
# Copyright (c) Voici Contributors

# Distributed under the terms of the Modified BSD License.import click

import argparse
import json
import re
from datetime import datetime
from typing import List
from packaging.version import parse as parse_version
from pathlib import Path
from subprocess import run

import tomlkit

ENC = dict(encoding="utf-8")
HATCH_VERSION = "hatch version"
PACKAGE_ROOT = Path(__file__).parent.parent
PROJECT_ROOT = PACKAGE_ROOT.parent.parent


def get_version():
    cmd = run(
        [HATCH_VERSION],
        capture_output=True,
        shell=True,
        check=True,
        cwd=PACKAGE_ROOT,
    )
    return cmd.stdout.decode("utf-8").strip().split("\n")[-1]


def next_version():
    v = parse_version(get_version())
    if v.is_prerelease:
        return f"{v.major}.{v.minor}.{v.micro}{v.pre[0]}{v.pre[1] + 1}"
    return f"{v.major}.{v.minor}.{v.micro + 1}"


def bump_jupytergis_deps(py_version: str):
    with open(PACKAGE_ROOT / "pyproject.toml", "r") as f:
        data = tomlkit.load(f)
    dependencies: List[str] = data["project"]["dependencies"]

    for index, value in enumerate(dependencies):
        if value.startswith("jupytergis"):
            lib = value.split("==")[0]
            dependencies[index] = f"{lib}=={py_version}"

    with open(PACKAGE_ROOT / "pyproject.toml", "w") as f:
        tomlkit.dump(data, f)


def bump_citation_cff(py_version: str):
    citation_file = PROJECT_ROOT / "CITATION.cff"
    content = citation_file.read_text(encoding="utf-8")

    # Replace `version: "{anything}"` with `version: "{py_version}"`
    version_pattern = r'^(\s*version: )"[^"]*"$'
    content, nsubs = re.subn(
        version_pattern,
        rf'\1"{py_version}"',
        content,
        flags=re.MULTILINE,
    )

    if nsubs != 1:
        raise ValueError(
            f"Expected exactly 1 'version' replacement in CITATION.cff, but made {nsubs} replacements"
        )

    # Replace `date-released: "{anything}"` with `date-released: "{today}"`
    today = datetime.now().strftime("%Y-%m-%d")
    date_pattern = r'^(\s*date-released: )"[^"]*"$'
    content, nsubs = re.subn(
        date_pattern,
        rf'\1"{today}"',
        content,
        flags=re.MULTILINE,
    )

    if nsubs != 1:
        raise ValueError(
            f"Expected exactly 1 'date-released' replacement in CITATION.cff, but made {nsubs} replacements"
        )

    citation_file.write_text(content, encoding="utf-8")


def bump():
    parser = argparse.ArgumentParser()
    parser.add_argument("version")
    args = parser.parse_args()
    py_version = next_version() if args.version == "next" else args.version
    js_version = (
        py_version.replace("a", "-alpha.").replace("b", "-beta.").replace("rc", "-rc.")
    )
    package_json = PACKAGE_ROOT.parent.parent / "package.json"
    root_json = json.loads(package_json.read_text(encoding="utf-8"))
    root_json["version"] = js_version
    package_json.write_text(json.dumps(root_json), encoding="utf-8")
    run(["yarn", "install"], check=True)
    run(
        [
            "node",
            f"{PACKAGE_ROOT.parent.parent / 'node_modules/prettier/bin/prettier.cjs'}",
            "--write",
            package_json,
        ],
        check=True,
    )
    # bump the Python version with hatch
    run(f"{HATCH_VERSION} {py_version}", shell=True, check=True, cwd=PACKAGE_ROOT)
    # pin jupytergis_* package to the same version
    bump_jupytergis_deps(py_version)
    # update CITATION.cff metadata
    bump_citation_cff(py_version)
    # bump the JS version with lerna
    run(f"yarn run bump:js:version {js_version}", shell=True, check=True)


if __name__ == "__main__":
    bump()
