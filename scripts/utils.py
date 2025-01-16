import subprocess

def execute(cmd: list, cwd=None):
    try:
        subprocess.run(cmd, check=True, cwd=cwd)
    except subprocess.CalledProcessError as e:
        raise Exception(f"Failed to execute command: {cmd}") from e
