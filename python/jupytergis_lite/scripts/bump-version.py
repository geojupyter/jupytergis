from pathlib import Path
from subprocess import run
from typing import List
from packaging.version import parse as parse_version
import tomlkit
import argparse

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
    run(f"{HATCH_VERSION} {py_version}", shell=True, check=True, cwd=ROOT)
    # pin jupytergis_* package to the same version
    bump_jupytergis_deps(py_version)


if __name__ == "__main__":
    bump()
