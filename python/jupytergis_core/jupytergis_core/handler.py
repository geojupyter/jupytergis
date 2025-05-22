import json
import logging
import os

import tornado
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
from tornado.httpclient import AsyncHTTPClient

# Configuration
ALLOWED_DOMAINS = {
    "https://geodes.cnes.fr",
    "https://gdh-portal-prod.cnes.fr",
    "https://geodes-portal.cnes.fr/api/stac/",
}
DEFAULT_TIMEOUT = 30  # seconds
CORS_ALLOW_ORIGIN = os.environ.get("JGIS_CORS_ORIGIN", "*")


class ProxyHandler(APIHandler):
    """Secure proxy handler with validation and async processing"""

    @tornado.web.authenticated
    async def get(self):
        """Process GET proxy request with validation and error handling"""
        try:
            # Validate and parse input
            url = self._validate_url(self.get_argument("url"))

            self.log.info("Proxying GET request to: %s", url)

            # Make async HTTP request
            response = await self._make_get_request(url)

            # Forward response
            self._set_response_headers(response)
            self.finish(response.body)

        except tornado.web.HTTPError:
            raise  # Already handled HTTP errors
        except Exception as e:
            self.log.exception("GET proxy request failed")
            self.set_status(500)
            self.finish(json.dumps({"error": "Internal server error"}))

    @tornado.web.authenticated
    async def post(self):
        """Process proxy request with validation and error handling"""
        try:
            # Validate and parse input
            url = self._validate_url(self.get_argument("url"))
            data = self._validate_payload(self.get_json_body())
            self.log.info("Proxying request to: %s", url)
            # Make async HTTP request
            response = await self._make_post_request(url, data)
            # Forward response
            self._set_response_headers(response)
            self.finish(response.body)
        except tornado.web.HTTPError:
            raise  # Already handled HTTP errors
        except Exception as e:
            self.log.exception("Proxy request failed")
            self.set_status(500)
            self.finish(json.dumps({"error": "Internal server error"}))

    def _validate_url(self, url):
        """Ensure URL is allowed and properly formatted"""
        if not any(url.startswith(domain) for domain in ALLOWED_DOMAINS):
            raise tornado.web.HTTPError(403, "Forbidden destination URL")
        return url

    def _validate_payload(self, data):
        """Validate and sanitize request payload"""
        if not data or not isinstance(data, dict):
            raise tornado.web.HTTPError(400, "Invalid request payload")
        return json.dumps(data)

    async def _make_get_request(self, url):
        """Execute GET request with async client"""
        client = AsyncHTTPClient()
        try:
            return await client.fetch(
                url,
                method="GET",
                validate_cert=os.environ.get("JGIS_VERIFY_SSL", "false").lower()
                == "true",
                request_timeout=DEFAULT_TIMEOUT,
                follow_redirects=True,
                headers={"Accept": "application/json"},  # Default accept header
            )
        except tornado.httpclient.HTTPClientError as e:
            self.log.error("Upstream GET error: %s", e)
            raise tornado.web.HTTPError(e.code, "Upstream service error") from e

    async def _make_post_request(self, url, data):
        """Execute proxy request with async client"""
        client = AsyncHTTPClient()
        try:
            return await client.fetch(
                url,
                method="POST",
                body=data,
                headers={"Content-Type": "application/json"},
                validate_cert=os.environ.get("JGIS_VERIFY_SSL", "false").lower()
                == "true",
                request_timeout=DEFAULT_TIMEOUT,
            )
        except tornado.httpclient.HTTPClientError as e:
            self.log.error("Upstream error: %s", e)
            raise tornado.web.HTTPError(e.code, "Upstream service error") from e

    def _set_response_headers(self, response):
        """Set appropriate CORS and content headers"""
        self.set_header("Access-Control-Allow-Origin", CORS_ALLOW_ORIGIN)
        self.set_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.set_header(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization, X-Requested-With",
        )
        self.set_header(
            "Content-Type", response.headers.get("Content-Type", "application/json")
        )


def setup_handlers(web_app):
    """Register handlers with proper configuration"""
    host_pattern = ".*$"
    base_url = web_app.settings["base_url"]

    # Configure proxy route
    proxy_route = url_path_join(base_url, "jupytergis_core", "proxy")
    handlers = [(proxy_route, ProxyHandler)]

    # Add conditional configuration
    if os.environ.get("JGIS_EXPOSE_MAPS", "false").lower() == "true":
        web_app.settings.setdefault("page_config_data", {})
        web_app.settings["page_config_data"]["jgis_expose_maps"] = True

    web_app.add_handlers(host_pattern, handlers)
    logging.info("JupyterGIS proxy endpoint registered at: %s", proxy_route)
