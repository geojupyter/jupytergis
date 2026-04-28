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
    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, "data.geojson")
        output_path = os.path.join(tmpdir, output_name)

        with open(input_path, "w") as f:
            f.write(geojson)

        # Build the command: <operation> [options...] <input> [<output for rasterize>]
        # For ogr2ogr the output comes from options (e.g. "output.geojson" at end).
        # For gdal_rasterize the output is a separate arg.
        cmd = [operation]

        if operation == "ogr2ogr":
            # ogr2ogr [options] dst_datasource src_datasource
            # The options list already contains the output name (e.g. "output.geojson")
            # Replace the output placeholder with actual path, then append input
            resolved_options = [output_path if o == output_name else o for o in options]
            cmd.extend(resolved_options)
            cmd.append(input_path)
        elif operation == "gdal_rasterize":
            # gdal_rasterize [options] src_datasource dst_datasource
            # Remove outputName from options if accidentally included
            resolved_options = [o for o in options if o != output_name]
            cmd.extend(resolved_options)
            cmd.append(input_path)
            cmd.append(output_path)
        else:
            # Generic: options + input
            cmd.extend(options)
            cmd.append(input_path)

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
                f"GDAL operation did not produce expected output: {output_name}",
            )

        # Determine output format based on file extension
        ext = Path(output_name).suffix
        is_binary = ext.lower() in {".tif", ".tiff", ".gpkg", ".shp"}

        if is_binary:
            with open(output_path, "rb") as f:
                return b64encode(f.read()).decode("ascii"), "base64"
        else:
            with open(output_path) as f:
                return f.read(), "text"
