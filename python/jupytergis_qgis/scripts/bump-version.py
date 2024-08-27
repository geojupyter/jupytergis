from pathlib import Path
from subprocess import run

HATCH_VERSION = "hatch version"
ROOT = Path(__file__).parent.parent


def bump():
    # bump the Python version with hatch
    run(f"{HATCH_VERSION}", shell=True, check=True, cwd=ROOT)


if __name__ == "__main__":
    bump()
