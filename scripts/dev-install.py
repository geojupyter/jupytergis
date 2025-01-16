from pathlib import Path

from utils import execute


def install_dev():
    root_path = Path(__file__).parents[1]

    try:
        execute(["uv", "--version"])
    except FileNotFoundError as e:
        raise Exception(
            "uv is not installed. Please refer to https://docs.astral.sh/uv/configuration/installer/ for installation instructions."
        ) from e

    execute(["uv", "venv"])
    execute(["uv", "sync", "--all-groups"])

    execute(["jlpm", "install"])
    execute(["jlpm", "build"])

    execute(["jupyter", "server", "extension", "enable", "jupytergis_qgis"])

    for py_package in ["jupytergis_core", "jupytergis_lab", "jupytergis_qgis"]:
        package_path = root_path / "python" / py_package
        try:
            execute(
                [
                    "jupyter",
                    "labextension",
                    "develop",
                    str(package_path),
                    "--overwrite",
                ]
            )
        except Exception as e:
            print(f"Error setting up labextension for {py_package}: {e}")


if __name__ == "__main__":
    install_dev()
