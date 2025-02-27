import subprocess
from pathlib import Path


def execute(cmd: str, cwd=None):
    subprocess.run(cmd.split(" "), check=True, cwd=cwd)


def build_packages():
    root_path = Path(__file__).parents[1]
    requirements_build_path = root_path / "requirements-build.txt"
    install_build_deps = f"python -m pip install -r {requirements_build_path}"

    python_package_prefix = "python"
    python_packages = [
        "jupytergis",
        "jupytergis_core",
        "jupytergis_lab",
        "jupytergis_qgis",
        "jupytergis_lite",
    ]

    execute(install_build_deps)

    for py_package in python_packages:
        execute("hatch build", cwd=root_path / python_package_prefix / py_package)


if __name__ == "__main__":
    build_packages()
