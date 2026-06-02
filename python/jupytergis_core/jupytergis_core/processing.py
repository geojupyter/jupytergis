import logging
import os
import shutil
import subprocess
import tempfile
from base64 import b64encode
from pathlib import Path
from urllib.parse import urlparse

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


def run_gdal_url_with_cutline(
    operation: str,
    options: list[str],
    url: str,
    cutline_geojson: str,
    output_name: str,
) -> tuple[str, str]:
    """Execute a GDAL CLI command on a remote raster URL with a vector cutline.

    Writes the cutline GeoJSON to a temp file and substitutes ``{cutlinePath}``
    in ``options`` with that file's path. Reads the raster via ``/vsicurl/``
    so GDAL can issue HTTP range requests (efficient for COGs).

    Returns (content, format) where format is "text" or "base64".
    """
    safe_output_name = Path(output_name).name
    if not safe_output_name:
        raise ValueError(f"Invalid output_name: {output_name!r}")

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"Invalid URL scheme: {parsed.scheme!r}")

    vsicurl_input = f"/vsicurl/{url}"

    with tempfile.TemporaryDirectory() as tmpdir:
        cutline_path = os.path.join(tmpdir, "cutline.geojson")
        with open(cutline_path, "w") as f:
            f.write(cutline_geojson)

        # Pre-simplify the cutline. gdalwarp tests every output pixel against
        # each vertex of the cutline polygon, so dense boundaries (e.g. GADM
        # admin regions with thousands of vertices) can dominate runtime.
        # 5e-4 deg ≈ 50 m, invisible at typical COG resolutions ≥100 m.
        simplified_path = os.path.join(tmpdir, "cutline_simplified.geojson")
        simpl = subprocess.run(
            [
                "ogr2ogr",
                "-f",
                "GeoJSON",
                "-simplify",
                "0.0005",
                simplified_path,
                cutline_path,
            ],
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        if simpl.returncode == 0 and os.path.exists(simplified_path):
            cutline_path = simplified_path

        output_path = os.path.join(tmpdir, safe_output_name)
        resolved_options = [
            o.replace("{cutlinePath}", cutline_path).replace(
                "{outputName}",
                output_path,
            )
            for o in options
        ]

        cmd = [operation, *resolved_options, vsicurl_input]
        if operation in {"gdal_rasterize", "gdalwarp", "gdal_translate"}:
            cmd.append(output_path)

        logger.info(
            "Running GDAL (vsicurl+cutline): %s -> %s",
            operation,
            safe_output_name,
        )

        # gdalwarp on a remote COG with a vector cutline can take several
        # minutes for large rasters. Give it a generous ceiling.
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=900,
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

        ext = Path(safe_output_name).suffix
        is_binary = ext.lower() in {".tif", ".tiff", ".gpkg", ".shp"}

        if is_binary:
            with open(output_path, "rb") as f:
                return b64encode(f.read()).decode("ascii"), "base64"
        else:
            with open(output_path) as f:
                return f.read(), "text"


def run_gdal_url(
    operation: str,
    options: list[str],
    url: str,
    output_name: str,
) -> tuple[str, str]:
    """Execute a GDAL CLI command on a remote URL via /vsicurl/.

    Uses GDAL's /vsicurl/ virtual filesystem driver so GDAL can issue
    HTTP range requests rather than downloading the entire file — essential
    for Cloud-Optimized GeoTIFFs (COGs).

    Returns (content, format) where format is "text" or "base64".
    """
    safe_output_name = Path(output_name).name
    if not safe_output_name:
        raise ValueError(f"Invalid output_name: {output_name!r}")

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"Invalid URL scheme: {parsed.scheme!r}")

    vsicurl_input = f"/vsicurl/{url}"

    with tempfile.TemporaryDirectory() as tmpdir:
        output_path = os.path.join(tmpdir, safe_output_name)
        resolved_options = [o.replace("{outputName}", output_path) for o in options]

        cmd = [operation, *resolved_options, vsicurl_input]
        if operation in {"gdal_rasterize", "gdalwarp", "gdal_translate"}:
            cmd.append(output_path)

        logger.info("Running GDAL (vsicurl): %s -> %s", operation, safe_output_name)

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,
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

        ext = Path(safe_output_name).suffix
        is_binary = ext.lower() in {".tif", ".tiff", ".gpkg", ".shp"}

        if is_binary:
            with open(output_path, "rb") as f:
                return b64encode(f.read()).decode("ascii"), "base64"
        else:
            with open(output_path) as f:
                return f.read(), "text"
