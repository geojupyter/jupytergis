import json
import logging
import os
import shutil
import subprocess
import tempfile
from base64 import b64encode
from typing import Any

import tornado
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join

logger = logging.getLogger(__name__)

# GDAL CLI tools we support
ALLOWED_OPERATIONS = {"ogr2ogr", "gdal_rasterize", "gdalwarp", "gdal_translate"}


def _gdal_available() -> bool:
    """Check if GDAL CLI tools are available on the system."""
    return shutil.which("ogr2ogr") is not None


class ProcessingHandler(APIHandler):
    """Handler for server-side GDAL processing operations.

    GET  — returns whether server-side GDAL is available.
    POST — runs a GDAL CLI operation and returns the result.
    """

    @tornado.web.authenticated
    async def get(self):
        """Return GDAL availability status."""
        available = _gdal_available()
        version = None
        if available:
            try:
                result = subprocess.run(
                    ["ogr2ogr", "--version"],
                    capture_output=True,
                    text=True,
                    timeout=5,
                )
                version = result.stdout.strip()
            except Exception:
                pass

        self.finish(json.dumps({"available": available, "version": version}))

    @tornado.web.authenticated
    async def post(self):
        """Run a GDAL processing operation.

        Expected JSON body:
        {
            "operation": "ogr2ogr" | "gdal_rasterize" | ...,
            "options": ["-f", "GeoJSON", "-dialect", "SQLITE", "-sql", "...", "output.geojson"],
            "geojson": "<geojson string>",
            "outputName": "output.geojson"
        }

        Returns:
        {
            "result": "<output content>",
            "format": "text" | "base64"
        }
        """
        try:
            body = json.loads(self.request.body)
        except json.JSONDecodeError:
            self.set_status(400)
            self.finish(json.dumps({"error": "Invalid JSON body"}))
            return

        operation = body.get("operation")
        options = body.get("options", [])
        geojson = body.get("geojson")
        output_name = body.get("outputName", "output.geojson")

        if operation not in ALLOWED_OPERATIONS:
            self.set_status(400)
            self.finish(
                json.dumps(
                    {
                        "error": f"Unsupported operation: {operation}. "
                        f"Allowed: {sorted(ALLOWED_OPERATIONS)}"
                    }
                )
            )
            return

        if not geojson:
            self.set_status(400)
            self.finish(json.dumps({"error": "Missing 'geojson' field"}))
            return

        if not _gdal_available():
            self.set_status(503)
            self.finish(
                json.dumps({"error": "GDAL CLI tools are not installed on the server"})
            )
            return

        # Validate options — must all be strings, no shell injection
        if not isinstance(options, list) or not all(
            isinstance(o, str) for o in options
        ):
            self.set_status(400)
            self.finish(json.dumps({"error": "'options' must be a list of strings"}))
            return

        try:
            (
                result_content,
                result_format,
            ) = await tornado.ioloop.IOLoop.current().run_in_executor(
                None,
                lambda: _run_gdal(operation, options, geojson, output_name),
            )
        except subprocess.TimeoutExpired:
            self.set_status(504)
            self.finish(json.dumps({"error": "GDAL operation timed out"}))
            return
        except subprocess.CalledProcessError as e:
            logger.error("GDAL %s failed: %s", operation, e.stderr)
            self.set_status(500)
            self.finish(json.dumps({"error": f"GDAL error: {e.stderr.strip()}"}))
            return
        except Exception as e:
            logger.error("Processing error: %s", e)
            self.set_status(500)
            self.finish(json.dumps({"error": str(e)}))
            return

        self.finish(json.dumps({"result": result_content, "format": result_format}))


def _run_gdal(
    operation: str,
    options: list[str],
    geojson: str,
    output_name: str,
) -> tuple[str, str]:
    """Execute a GDAL CLI command in a temp directory.

    Returns (content, format) where format is "text" or "base64".
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, "input.geojson")
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
        )

        if result.returncode != 0:
            raise subprocess.CalledProcessError(
                result.returncode, cmd, result.stdout, result.stderr
            )

        if not os.path.exists(output_path):
            raise FileNotFoundError(
                f"GDAL operation did not produce expected output: {output_name}"
            )

        # Determine output format based on file extension
        _, ext = os.path.splitext(output_name)
        is_binary = ext.lower() in {".tif", ".tiff", ".gpkg", ".shp"}

        if is_binary:
            with open(output_path, "rb") as f:
                return b64encode(f.read()).decode("ascii"), "base64"
        else:
            with open(output_path, "r") as f:
                return f.read(), "text"


def setup_processing_handlers(web_app: Any) -> None:
    """Register the processing handler."""
    host_pattern = ".*$"
    base_url = web_app.settings["base_url"]

    processing_route = url_path_join(base_url, "jupytergis_core", "processing")
    handlers = [(processing_route, ProcessingHandler)]

    web_app.add_handlers(host_pattern, handlers)
    logger.info("JupyterGIS processing endpoint initialized at: %s", processing_route)
