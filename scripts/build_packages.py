"""Build all JupyterGIS packages.

IMPORTANT: Requires dependencies in requirements-build.txt
"""

import subprocess
from pathlib import Path


def execute(cmd: str, cwd=None):
    subprocess.run(cmd.split(" "), check=True, cwd=cwd)


def build_packages():
    root_path = Path(__file__).parents[1]

    python_package_prefix = "python"
    python_packages = [
        "jupytergis",
        "jupytergis_core",
        "jupytergis_lab",
        "jupytergis_qgis",
        "jupytergis_lite",
    ]

    for py_package in python_packages:
        execute("python -m build", cwd=root_path / python_package_prefix / py_package)


if __name__ == "__main__":
    build_packages()
