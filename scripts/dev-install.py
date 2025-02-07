import subprocess
from pathlib import Path


def execute(cmd: str, cwd=None):
    subprocess.run(cmd.split(" "), check=True, cwd=cwd)


def install_dev():
    root_path = Path(__file__).parents[1]
    requirements_build_path = root_path / "requirements-build.txt"
    install_build_deps = f"python -m pip install -r {requirements_build_path}"
    install_js_deps = "jlpm install"
    build_js = "jlpm build"

    python_package_prefix = "python"
    python_packages = [
        "jupytergis_core",
        "jupytergis_lab",
        "jupytergis_qgis",
        "jupytergis",
    ]

    execute(install_build_deps)
    execute(install_js_deps)
    execute(build_js)
    for py_package in python_packages:
        execute(f"pip uninstall {py_package} -y")
        execute("jlpm clean:all", cwd=root_path / "python" / py_package)
        execute(f"pip install -e {python_package_prefix}/{py_package}")

        if py_package == "jupytergis_qgis":
            execute("jupyter server extension enable jupytergis_qgis")

        # Only the metapackage doesn't have a labext
        if py_package != "jupytergis":
            execute(
                f"jupyter labextension develop {python_package_prefix}/{py_package} --overwrite"
            )


if __name__ == "__main__":
    install_dev()
