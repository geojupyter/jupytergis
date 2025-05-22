import json
import logging
import os
from urllib.parse import urlparse

import tornado
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
from tornado.httpclient import AsyncHTTPClient, HTTPRequest

# Configuration
ALLOWED_DOMAINS = {
    "https://geodes.cnes.fr",
    "https://gdh-portal-prod.cnes.fr",
    "https://geodes-portal.cnes.fr/api/stac/",
}
DEFAULT_TIMEOUT = 30  # seconds
MAX_REDIRECTS = 3
MAX_BODY_SIZE = 1024 * 1024 * 10  # 10MB


class ProxyHandler(APIHandler):
    """Secure proxy handler with enhanced validation and async processing"""

    def initialize(self):
        self.http_client = AsyncHTTPClient(
            defaults={
                "connect_timeout": DEFAULT_TIMEOUT,
                "request_timeout": DEFAULT_TIMEOUT,
                "max_redirects": MAX_REDIRECTS,
                "max_body_size": MAX_BODY_SIZE,
            }
        )

    @tornado.web.authenticated
    async def get(self):
        """Process GET requests with validation and error handling"""
        await self._handle_request("GET")

    @tornado.web.authenticated
    async def post(self):
        """Process POST requests with validation and error handling"""
        await self._handle_request("POST")

    async def _handle_request(self, method):
        """Central request handling method"""
        try:
            # Validate and parse input
            url = self._validate_url(self.get_argument("url"))
            body = await self._validate_body(method)

            self.log.info("Proxying %s request to: %s", method, url)

            # Make async HTTP request
            response = await self._make_request(url, method, body)

            # Forward response
            self._set_response_headers(response)
            self.finish(response.body)

        except tornado.web.HTTPError as e:
            self.log.warning("Client error: %s", e)
            raise
        except Exception as e:
            self.log.exception("Proxy request failed")
            self._handle_error_response(e)

    def _validate_url(self, url):
        """Validate and sanitize target URL"""
        parsed = urlparse(url)

        if parsed.scheme not in ("http", "https"):
            raise tornado.web.HTTPError(400, "Invalid protocol")

        if not any(url.startswith(domain) for domain in ALLOWED_DOMAINS):
            self.log.warning("Blocked disallowed domain: %s", url)
            raise tornado.web.HTTPError(403, "Forbidden destination")

        return url

    async def _validate_body(self, method):
        """Validate and prepare request body"""
        if method == "POST":
            try:
                body = self.get_json_body()
                if not body or not isinstance(body, dict):
                    raise ValueError("Invalid JSON body")
                return json.dumps(body)
            except json.JSONDecodeError:
                raise tornado.web.HTTPError(400, "Malformed JSON payload") from e
        return None

    async def _make_request(self, url, method, body=None):
        """Execute proxy request with safety controls"""
        try:
            request = HTTPRequest(
                url=url,
                method=method,
                body=body,
                headers={"Content-Type": "application/json"} if body else None,
                validate_cert=os.environ.get("JGIS_VERIFY_SSL", "false").lower()
                == "true",
                allow_nonstandard_methods=False,
                decompress_response=True,
            )

            return await self.http_client.fetch(request)

        except tornado.httpclient.HTTPClientError as e:
            self.log.error("Upstream error: %d %s", e.code, e.message)
            raise tornado.web.HTTPError(e.code, "Upstream service error") from e
        except tornado.httpclient.HTTPError as e:
            self.log.error("Network error: %s", str(e))
            raise tornado.web.HTTPError(503, "Service unavailable") from e

    def _set_response_headers(self, response):
        """Set secure CORS and content headers"""
        self.set_header(
            "Access-Control-Allow-Origin", os.environ.get("JGIS_CORS_ORIGIN", "*")
        )
        self.set_header("Access-Control-Allow-Methods", "GET, POST")
        self.set_header(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization, X-Requested-With",
        )
        self.set_header("Content-Security-Policy", "default-src 'none'")
        self.set_header(
            "Content-Type", response.headers.get("Content-Type", "application/json")
        )

    def _handle_error_response(self, error):
        """Standardized error response handling"""
        self.set_status(500)
        self.finish(
            json.dumps({"error": "Internal server error", "code": "internal_error"})
        )


def setup_handlers(web_app):
    """Register handlers with configuration validation"""
    host_pattern = ".*$"
    base_url = web_app.settings["base_url"]

    # Configure proxy route
    proxy_route = url_path_join(base_url, "jupytergis_core", "proxy")
    handlers = [(proxy_route, ProxyHandler)]

    # Add feature flags
    if os.environ.get("JGIS_EXPOSE_MAPS", "false").lower() == "true":
        web_app.settings.setdefault("page_config_data", {})
        web_app.settings["page_config_data"]["jgis_expose_maps"] = True

    web_app.add_handlers(host_pattern, handlers)
    logging.info("JupyterGIS proxy endpoint initialized at: %s", proxy_route)
