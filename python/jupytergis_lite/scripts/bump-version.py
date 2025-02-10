from pathlib import Path
from subprocess import run
from typing import List
import tomlkit
import argparse

HATCH_VERSION = "hatch version"
ROOT = Path(__file__).parent.parent


def bump_jupytergis_deps(py_version: str):
    with open(ROOT / "pyproject.toml", "r") as f:
        data = tomlkit.load(f)
    dependencies: List[str] = data["project"]["dependencies"]

    for index, value in enumerate(dependencies):
        if value.startswith("jupytergis"):
            lib = value.split("==")[0]
            dependencies[index] = f"{lib}=={py_version}"

    with open(ROOT / "pyproject.toml", "w") as f:
        tomlkit.dump(data, f)


def bump():
    parser = argparse.ArgumentParser()
    parser.add_argument("version")
    args = parser.parse_args()
    py_version = next_version() if args.version == "next" else args.version
    # bump the Python version with hatch
    run(f"{HATCH_VERSION}", shell=True, check=True, cwd=ROOT)
    # pin jupytergis_* package to the same version
    bump_jupytergis_deps(py_version)


if __name__ == "__main__":
    bump()
