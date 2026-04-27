import subprocess
from pathlib import Path


def execute(cmd: str, cwd=None):
    subprocess.run(cmd.split(" "), check=True, cwd=cwd)


def install_dev():
    root_path = Path(__file__).parents[1]

    python_package_prefix = "python"
    python_packages = [
        "jupytergis_core",
        "jupytergis_lab",
        "jupytergis_qgis",
    ]

    execute("python -m pip install --group build")
    execute("jlpm install")
    execute("jlpm build")
    for py_package in python_packages:
        execute(f"pip uninstall {py_package} -y")
        execute("jlpm clean:all", cwd=root_path / "python" / py_package)
        execute(f"pip install -e {python_package_prefix}/{py_package}")

        if py_package == "jupytergis_qgis":
            execute("jupyter server extension enable jupytergis_qgis")

        execute(
            f"jupyter labextension develop {python_package_prefix}/{py_package} --overwrite",
        )

    execute(f"pip install -e {python_package_prefix}/jupytergis")


if __name__ == "__main__":
    install_dev()
