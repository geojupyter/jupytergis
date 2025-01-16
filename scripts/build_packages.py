from pathlib import Path

from utils import execute


def build_packages():
    root_path = Path(__file__).parents[1]

    try:
        execute(["uv", "--version"])
    except FileNotFoundError as e:
        raise Exception(
            "uv is not installed. Please refer to https://docs.astral.sh/uv/configuration/installer/ for installation instructions."
        ) from e

    execute(["uv", "sync", "--group", "build"])

    for py_package in ["jupytergis_core", "jupytergis_lab", "jupytergis_qgis"]:
        package_path = root_path / "python" / py_package
        execute(["hatch", "build"], cwd=package_path)


if __name__ == "__main__":
    build_packages()
