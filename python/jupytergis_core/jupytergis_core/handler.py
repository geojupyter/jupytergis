import json
import logging
import os
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

import tornado
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
from tornado.httpclient import AsyncHTTPClient, HTTPRequest, HTTPResponse


@dataclass
class ProxyConfig:
    """Configuration for the proxy handler."""

    default_timeout: int
    max_redirects: int
    max_body_size: int
    rate_limit_requests: int
    rate_limit_window: int
    cors_origin: str
    exempt_domains: set[str]


def load_config() -> ProxyConfig:
    """Load configuration from environment variables with defaults."""
    return ProxyConfig(
        default_timeout=int(os.environ.get("JGIS_TIMEOUT", "30")),
        max_redirects=int(os.environ.get("JGIS_MAX_REDIRECTS", "3")),
        max_body_size=int(os.environ.get("JGIS_MAX_BODY_SIZE", str(10 * 1024 * 1024))),
        rate_limit_requests=int(os.environ.get("JGIS_RATE_LIMIT_REQUESTS", "100")),
        rate_limit_window=int(os.environ.get("JGIS_RATE_LIMIT_WINDOW", "60")),
        cors_origin=os.environ.get("JGIS_CORS_ORIGIN", "*"),
        exempt_domains=os.environ.get(
            "JGIS_EXEMPT_DOMAINS",
            {
                "https://geodes.cnes.fr",
                "https://gdh-portal-prod.cnes.fr",
                "https://geodes-portal.cnes.fr/api/stac/",
            },
        ),
    )


# Configure logging
logger = logging.getLogger(__name__)


class ProxyError(Exception):
    """Base exception for proxy-related errors."""


class ValidationError(ProxyError):
    """Raised when request validation fails."""


class RateLimitError(ProxyError):
    """Raised when rate limit is exceeded."""


class ProxyHandler(APIHandler):
    """Secure proxy handler with enhanced validation and async processing."""

    def initialize(self) -> None:
        """Initialize the handler with configuration and HTTP client."""
        self.proxy_config = load_config()
        self._request_timestamps = []
        self.http_client = AsyncHTTPClient(
            defaults={
                "connect_timeout": self.proxy_config.default_timeout,
                "request_timeout": self.proxy_config.default_timeout,
                "max_redirects": self.proxy_config.max_redirects,
                "max_body_size": self.proxy_config.max_body_size,
            },
        )

    def _check_rate_limit(self) -> None:
        """Check if the current request exceeds rate limits.

        Raises:
            RateLimitError: If rate limit is exceeded

        """
        current_time = time.time()
        window_start = current_time - self.proxy_config.rate_limit_window

        # Remove old timestamps
        self._request_timestamps = [
            ts for ts in self._request_timestamps if ts > window_start
        ]

        if len(self._request_timestamps) >= self.proxy_config.rate_limit_requests:
            raise RateLimitError("Rate limit exceeded")

        self._request_timestamps.append(current_time)

    @tornado.web.authenticated
    async def get(self) -> None:
        """Process GET requests with validation and error handling."""
        await self._handle_request("GET")

    @tornado.web.authenticated
    async def post(self) -> None:
        """Process POST requests with validation and error handling."""
        await self._handle_request("POST")

    def _parse_headers(self) -> dict[str, str]:
        """Parse and validate optional forwarded headers from the request.

        The caller may pass a JSON-encoded object via the ``headers`` query
        parameter.  Only string keys and values are accepted; any other shape
        raises a ValidationError.

        Returns:
            A (possibly empty) dict of header name → value pairs.

        Raises:
            ValidationError: If the ``headers`` parameter is present but
                cannot be decoded or is not a flat string→string mapping.

        """
        raw = self.get_argument("headers", None)
        if raw is None:
            return {}
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValidationError("Invalid JSON in 'headers' parameter") from exc
        if not isinstance(parsed, dict) or not all(
            isinstance(k, str) and isinstance(v, str) for k, v in parsed.items()
        ):
            raise ValidationError(
                "'headers' must be a flat JSON object with string keys and values",
            )
        # Block headers that could interfere with the proxy itself.
        blocked = {"host", "content-length", "transfer-encoding", "connection"}
        return {k: v for k, v in parsed.items() if k.lower() not in blocked}

    async def _handle_request(self, method: str) -> None:
        """Central request handling method.

        Args:
            method: The HTTP method to use (GET or POST)

        Raises:
            tornado.web.HTTPError: If the request fails validation or processing

        """
        try:
            # Check rate limit
            self._check_rate_limit()

            # Validate and parse input
            url = self._validate_url(self.get_argument("url"))
            body = await self._validate_body(method)
            extra_headers = self._parse_headers()

            logger.info("Proxying %s request to: %s", method, url)

            # Make async HTTP request
            response = await self._make_request(url, method, body, extra_headers)

            # Forward response
            self._set_response_headers(response)
            self.finish(response.body)

        except RateLimitError as e:
            logger.warning("Rate limit exceeded: %s", e)
            self.set_status(429)
            self.finish(
                json.dumps(
                    {
                        "error": "Rate limit exceeded",
                        "code": "rate_limit_error",
                        "message": str(e),
                    },
                ),
            )

        except ValidationError as e:
            logger.warning("Validation error: %s", e)
            self.set_status(400)
            self.finish(
                json.dumps(
                    {
                        "error": "Validation error",
                        "code": "validation_error",
                        "message": str(e),
                    },
                ),
            )

        except tornado.web.HTTPError as e:
            logger.warning("Client error: %s", e)
            raise

        except Exception as e:
            logger.exception("Proxy request failed")
            self._handle_error_response(e)

    def _validate_url(self, url: str) -> str:
        """Validate and sanitize target URL.

        Args:
            url: The URL to validate

        Returns:
            The validated URL

        Raises:
            ValidationError: If the URL is invalid

        """
        parsed = urlparse(url)

        if parsed.scheme not in ("http", "https"):
            raise ValidationError("Invalid protocol")

        return url

    async def _validate_body(self, method: str) -> str | None:
        """Validate and prepare request body.

        Args:
            method: The HTTP method being used

        Returns:
            The validated and prepared request body, or None for GET requests

        Raises:
            ValidationError: If the body is invalid

        """
        if method == "POST":
            try:
                body = self.get_json_body()
                if not body or not isinstance(body, dict):
                    raise ValidationError("Invalid JSON body")

                # Validate body size
                body_str = json.dumps(body)
                if len(body_str.encode("utf-8")) > self.proxy_config.max_body_size:
                    raise ValidationError("Request body too large")

                return body_str
            except json.JSONDecodeError as e:
                raise ValidationError("Malformed JSON payload") from e

        return None

    async def _make_request(
        self,
        url: str,
        method: str,
        body: str | None = None,
        extra_headers: dict[str, str] | None = None,
    ) -> HTTPResponse:
        """Execute proxy request with safety controls.

        Args:
            url: The target URL
            method: The HTTP method to use
            body: Optional request body
            extra_headers: Optional headers to forward to the upstream server
                (e.g. Authorization, X-API-Key).

        Returns:
            The HTTP response

        Raises:
            tornado.web.HTTPError: If the request fails

        """
        try:
            parsed_url = urlparse(url)
            host = parsed_url.netloc.split(":")[0]  # Remove port if present

            # Disable SSL verification for exempt domains
            validate_cert = host not in self.proxy_config.exempt_domains
            logger.info("validate_cert: %s", validate_cert)

            headers: dict[str, str] = {}
            if body:
                headers["Content-Type"] = "application/json"
            if extra_headers:
                headers.update(extra_headers)

            request = HTTPRequest(
                url=url,
                method=method,
                body=body,
                headers=headers or None,
                validate_cert=validate_cert,
                allow_nonstandard_methods=False,
                decompress_response=True,
            )

            return await self.http_client.fetch(request)

        except tornado.httpclient.HTTPClientError as e:
            logger.error("Upstream error: %d %s", e.code, e.message)
            raise tornado.web.HTTPError(e.code, "Upstream service error") from e

        except tornado.httpclient.HTTPError as e:
            logger.error("Network error: %s", str(e))
            raise tornado.web.HTTPError(503, "Service unavailable") from e

    def _set_response_headers(self, response: HTTPResponse) -> None:
        """Set secure CORS and content headers.

        Args:
            response: The HTTP response to get headers from

        """
        self.set_header("Access-Control-Allow-Origin", self.proxy_config.cors_origin)
        self.set_header("Access-Control-Allow-Methods", "GET, POST")
        self.set_header(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization, X-Requested-With",
        )
        self.set_header("Content-Security-Policy", "default-src 'none'")
        self.set_header(
            "Content-Type",
            response.headers.get("Content-Type", "application/json"),
        )

    def _handle_error_response(self, error: Exception) -> None:
        """Standardized error response handling.

        Args:
            error: The exception that occurred

        """
        self.set_status(500)
        self.finish(
            json.dumps(
                {
                    "error": "Internal server error",
                    "code": "internal_error",
                    "message": str(error),
                },
            ),
        )


def setup_handlers(web_app: Any) -> None:
    """Register handlers with configuration validation.

    Args:
        web_app: The Jupyter web application instance

    """
    host_pattern = ".*$"
    base_url = web_app.settings["base_url"]

    # Configure proxy route
    proxy_route = url_path_join(base_url, "jupytergis_core", "proxy")
    handlers = [(proxy_route, ProxyHandler)]

    # Add feature flags
    if os.environ.get("JGIS_EXPOSE_MAPS", False):
        web_app.settings.setdefault("page_config_data", {})
        web_app.settings["page_config_data"]["jgis_expose_maps"] = True

    web_app.add_handlers(host_pattern, handlers)
    logger.info("JupyterGIS proxy endpoint initialized at: %s", proxy_route)
