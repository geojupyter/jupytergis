import logging
import os
import shutil
import subprocess
import tempfile
from base64 import b64encode
from pathlib import Path

logger = logging.getLogger(__name__)

# GDAL CLI tools we support
ALLOWED_OPERATIONS = {"ogr2ogr", "gdal_rasterize", "gdalwarp", "gdal_translate"}


def gdal_available() -> bool:
    """Check if GDAL CLI tools are available on the system."""
    return shutil.which("ogr2ogr") is not None


def run_gdal(
    operation: str,
    options: list[str],
    geojson: str,
    output_name: str,
) -> tuple[str, str]:
    """Execute a GDAL CLI command in a temp directory.

    Returns (content, format) where format is "text" or "base64".
    """
    safe_output_name = Path(output_name).name
    if not safe_output_name:
        raise ValueError(f"Invalid output_name: {output_name!r}")

    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, "data.geojson")
        output_path = os.path.join(tmpdir, safe_output_name)

        with open(input_path, "w") as f:
            f.write(geojson)

        # Substitute the {outputName} placeholder in options with the actual path.
        # Callers should template the output filename in `options` rather than
        # hardcoding it, so we know unambiguously where the output will land.
        resolved_options = [o.replace("{outputName}", output_path) for o in options]

        # ogr2ogr embeds the output path inside options (via {outputName}).
        # gdal_rasterize, gdalwarp, and gdal_translate require the destination
        # dataset as a separate trailing positional argument.
        cmd = [operation, *resolved_options, input_path]
        if operation in {"gdal_rasterize", "gdalwarp", "gdal_translate"}:
            cmd.append(output_path)

        logger.info("Running GDAL: %s", " ".join(cmd))

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,
            cwd=tmpdir,
            check=False,
        )

        if result.returncode != 0:
            raise subprocess.CalledProcessError(
                result.returncode,
                cmd,
                result.stdout,
                result.stderr,
            )

        if not os.path.exists(output_path):
            raise FileNotFoundError(
                f"GDAL operation did not produce expected output: {safe_output_name}",
            )

        # Determine output format based on file extension
        ext = Path(safe_output_name).suffix
        is_binary = ext.lower() in {".tif", ".tiff", ".gpkg", ".shp"}

        if is_binary:
            with open(output_path, "rb") as f:
                return b64encode(f.read()).decode("ascii"), "base64"
        else:
            with open(output_path) as f:
                return f.read(), "text"
