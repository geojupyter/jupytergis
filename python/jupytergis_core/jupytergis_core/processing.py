import logging
import os
import shutil
import subprocess
import tempfile
import threading
import time
from base64 import b64encode
from collections.abc import Callable
from pathlib import Path
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# GDAL CLI tools we support
ALLOWED_OPERATIONS = {"ogr2ogr", "gdal_rasterize", "gdalwarp", "gdal_translate"}

# Optional callback invoked with a fractional progress value in [0.0, 1.0].
ProgressCallback = Callable[[float], None]


class ProcessingCancelledError(Exception):
    """Raised when a GDAL operation is cancelled via its ``cancel_event``.

    This happens when the client disconnects from the progress stream, at
    which point the running subprocess is killed.
    """


def gdal_available() -> bool:
    """Check if GDAL CLI tools are available on the system."""
    return shutil.which("ogr2ogr") is not None


def _run_gdal_command(
    cmd: list[str],
    cwd: str,
    timeout: int,
    progress_callback: ProgressCallback | None = None,
    cancel_event: "threading.Event | None" = None,
) -> str:
    """Run a GDAL CLI command, streaming its progress meter incrementally.

    GDAL CLI tools (gdalwarp, gdal_translate, gdal_rasterize, and ogr2ogr with
    ``-progress``) write a textual progress meter to stdout as they work, e.g.::

        0...10...20...30...40...50...60...70...80...90...100 - done.

    The numbers are emitted incrementally — not newline-delimited — so we read
    stdout one byte at a time on a background thread, parse each completed
    integer token, and forward it to ``progress_callback`` as a fraction in
    ``[0.0, 1.0]``. stderr is redirected to a temp file (and surfaced on
    failure) so a large warning stream can't deadlock the stdout reader.

    When ``cancel_event`` is set (e.g. because the client disconnected from the
    progress stream) the subprocess is killed and ``ProcessingCancelledError`` is
    raised.

    Returns the captured stderr text. Raises ``subprocess.CalledProcessError``
    on a non-zero exit, ``subprocess.TimeoutExpired`` if ``timeout`` elapses,
    and ``ProcessingCancelledError`` if cancelled.
    """
    # gdalwarp/gdal_translate/gdal_rasterize print a progress meter by default,
    # but ogr2ogr only does so with an explicit -progress flag. Inject it when
    # we actually have a consumer for the progress (i.e. a callback).
    if (
        progress_callback is not None
        and cmd
        and cmd[0] == "ogr2ogr"
        and "-progress" not in cmd
    ):
        cmd = [cmd[0], "-progress", *cmd[1:]]

    logger.info("Running GDAL: %s", " ".join(cmd))

    with tempfile.TemporaryFile() as stderr_file:
        proc = subprocess.Popen(
            cmd,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=stderr_file,
        )

        def _read_progress() -> None:
            digits = b""
            last_pct = -1
            assert proc.stdout is not None
            while True:
                ch = proc.stdout.read(1)
                if ch == b"":
                    break
                if progress_callback is None:
                    continue
                if ch.isdigit():
                    digits += ch
                    continue
                if digits:
                    try:
                        pct = int(digits)
                    except ValueError:
                        pct = -1
                    digits = b""
                    if 0 <= pct <= 100 and pct != last_pct:
                        last_pct = pct
                        try:
                            progress_callback(pct / 100.0)
                        except Exception:  # noqa: BLE001
                            # A misbehaving progress callback must never abort
                            # the GDAL run; progress reporting is best-effort.
                            logger.debug("progress_callback raised", exc_info=True)

        reader = threading.Thread(target=_read_progress, daemon=True)
        reader.start()

        # Poll for completion so we can also honour cancellation and the
        # timeout. Killing the process makes the stdout reader hit EOF.
        deadline = time.monotonic() + timeout
        cancelled = False
        while proc.poll() is None:
            if cancel_event is not None and cancel_event.is_set():
                cancelled = True
                proc.kill()
                break
            if time.monotonic() >= deadline:
                proc.kill()
                proc.wait()
                reader.join(timeout=1)
                raise subprocess.TimeoutExpired(cmd, timeout)
            time.sleep(0.05)

        proc.wait()
        reader.join(timeout=5)
        if proc.stdout is not None:
            proc.stdout.close()

        stderr_file.seek(0)
        stderr = stderr_file.read().decode(errors="replace")

    if cancelled:
        raise ProcessingCancelledError

    if proc.returncode != 0:
        raise subprocess.CalledProcessError(proc.returncode, cmd, "", stderr)

    return stderr


def run_gdal(
    operation: str,
    options: list[str],
    geojson: str,
    output_name: str,
    progress_callback: ProgressCallback | None = None,
    cancel_event: "threading.Event | None" = None,
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

        _run_gdal_command(
            cmd,
            cwd=tmpdir,
            timeout=120,
            progress_callback=progress_callback,
            cancel_event=cancel_event,
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
    progress_callback: ProgressCallback | None = None,
    cancel_event: "threading.Event | None" = None,
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

        # gdalwarp on a remote COG with a vector cutline can take several
        # minutes for large rasters. Give it a generous ceiling.
        _run_gdal_command(
            cmd,
            cwd=tmpdir,
            timeout=900,
            progress_callback=progress_callback,
            cancel_event=cancel_event,
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
    progress_callback: ProgressCallback | None = None,
    cancel_event: "threading.Event | None" = None,
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

        _run_gdal_command(
            cmd,
            cwd=tmpdir,
            timeout=300,
            progress_callback=progress_callback,
            cancel_event=cancel_event,
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
